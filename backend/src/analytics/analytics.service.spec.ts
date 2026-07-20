import { Test } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  $queryRaw: jest.Mock;
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Controlled dataset: each row is one employee's latest salary, exactly
   * what the DISTINCT ON raw query returns. Amounts are mixed string/number
   * to mirror how a Decimal column can come back from the pg driver, and to
   * verify numeric coercion happens before any arithmetic.
   *
   *   department    country         currency  amount
   *   Engineering   United States   USD       100000.00   (A)
   *   Engineering   United States   USD       120000.00   (B)
   *   Engineering   India           INR       1500000.00  (C)
   *   Sales         United States   USD       80000.00    (D)
   *   Sales         United States   USD       90000.00    (E)
   *   Engineering   India           INR       1300000.00  (F)
   *   Sales         India           INR       900000       (G, plain number)
   */
  const rows = [
    {
      department: 'Engineering',
      country: 'United States',
      currency: 'USD',
      amount: '100000.00',
    },
    {
      department: 'Engineering',
      country: 'United States',
      currency: 'USD',
      amount: '120000.00',
    },
    {
      department: 'Engineering',
      country: 'India',
      currency: 'INR',
      amount: '1500000.00',
    },
    {
      department: 'Sales',
      country: 'United States',
      currency: 'USD',
      amount: '80000.00',
    },
    {
      department: 'Sales',
      country: 'United States',
      currency: 'USD',
      amount: '90000.00',
    },
    {
      department: 'Engineering',
      country: 'India',
      currency: 'INR',
      amount: '1300000.00',
    },
    {
      department: 'Sales',
      country: 'India',
      currency: 'INR',
      amount: 900000,
    },
  ];

  describe('getSummary', () => {
    it('excludes terminated employees in the underlying query', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getSummary();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const [strings] = prisma.$queryRaw.mock.calls[0] as [
        TemplateStringsArray,
      ];
      const sql = strings.join('');
      expect(sql).toContain('DISTINCT ON');
      expect(sql).toContain("status != 'TERMINATED'");
    });

    it('returns zeroed-out results for an empty dataset', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.headcount).toBe(0);
      expect(result.byDepartment).toEqual([]);
      expect(result.byCountry).toEqual([]);
      expect(result.payrollCostByCurrency).toEqual([]);
      expect(result.salaryDistribution).toEqual([
        { label: '<75%', count: 0 },
        { label: '75-90%', count: 0 },
        { label: '90-110%', count: 0 },
        { label: '110-125%', count: 0 },
        { label: '125-150%', count: 0 },
        { label: '150%+', count: 0 },
      ]);
    });

    it('computes headcount as the number of latest-salary rows', async () => {
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.getSummary();

      expect(result.headcount).toBe(7);
    });

    it('breaks down avg/median salary by department, split by currency', async () => {
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.getSummary();

      expect(result.byDepartment).toEqual([
        {
          department: 'Engineering',
          currency: 'INR',
          headcount: 2,
          avgSalary: 1400000,
          medianSalary: 1400000,
        },
        {
          department: 'Engineering',
          currency: 'USD',
          headcount: 2,
          avgSalary: 110000,
          medianSalary: 110000,
        },
        {
          department: 'Sales',
          currency: 'INR',
          headcount: 1,
          avgSalary: 900000,
          medianSalary: 900000,
        },
        {
          department: 'Sales',
          currency: 'USD',
          headcount: 2,
          avgSalary: 85000,
          medianSalary: 85000,
        },
      ]);
    });

    it('breaks down avg/median salary by country', async () => {
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.getSummary();

      expect(result.byCountry).toEqual([
        {
          country: 'India',
          currency: 'INR',
          headcount: 3,
          avgSalary: 1233333.33,
          medianSalary: 1300000,
        },
        {
          country: 'United States',
          currency: 'USD',
          headcount: 4,
          avgSalary: 97500,
          medianSalary: 95000,
        },
      ]);
    });

    it('sums total payroll cost per currency', async () => {
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.getSummary();

      expect(result.payrollCostByCurrency).toEqual([
        { currency: 'INR', total: 3700000 },
        { currency: 'USD', total: 390000 },
      ]);
    });

    it('buckets employees by compa-ratio within their own currency', async () => {
      prisma.$queryRaw.mockResolvedValue(rows);

      const result = await service.getSummary();

      // USD median = 95000: A=1.053 (90-110%), B=1.263 (125-150%), D=0.842 (75-90%), E=0.947 (90-110%)
      // INR median = 1300000: C=1.154 (110-125%), F=1.0 (90-110%), G=0.692 (<75%)
      expect(result.salaryDistribution).toEqual([
        { label: '<75%', count: 1 },
        { label: '75-90%', count: 1 },
        { label: '90-110%', count: 3 },
        { label: '110-125%', count: 1 },
        { label: '125-150%', count: 1 },
        { label: '150%+', count: 0 },
      ]);
    });
  });
});
