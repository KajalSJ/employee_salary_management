import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SalariesService } from './salaries.service';
import { PrismaService } from '../prisma/prisma.service';
import { SalaryChangeReason } from '../../generated/prisma/enums';

type PrismaMock = {
  employee: {
    findUnique: jest.Mock;
  };
  salaryRecord: {
    create: jest.Mock;
  };
};

describe('SalariesService', () => {
  let service: SalariesService;
  let prisma: PrismaMock;

  const employee = {
    id: 'emp-1',
    name: 'Ada Lovelace',
    email: 'ada@acme.com',
    department: 'Engineering',
    country: 'United Kingdom',
    currency: 'GBP',
    jobTitle: 'Senior Software Engineer',
    status: 'ACTIVE',
    hireDate: new Date('2020-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn() },
      salaryRecord: { create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [SalariesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SalariesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      amount: 95000,
      effectiveDate: '2026-08-01',
      reason: SalaryChangeReason.HIKE,
    };

    it('creates a salary record using the employee currency, converting effectiveDate to a Date', async () => {
      prisma.employee.findUnique.mockResolvedValue(employee);
      prisma.salaryRecord.create.mockResolvedValue({
        id: 'sal-1',
        employeeId: 'emp-1',
        amount: dto.amount,
        currency: employee.currency,
        effectiveDate: new Date(dto.effectiveDate),
        reason: dto.reason,
        createdAt: new Date(),
      });

      await service.create('emp-1', dto);

      expect(prisma.salaryRecord.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp-1',
          amount: dto.amount,
          currency: employee.currency,
          effectiveDate: new Date(dto.effectiveDate),
          reason: dto.reason,
        },
      });
    });

    it('ignores any client-supplied currency and always uses the employee currency', async () => {
      prisma.employee.findUnique.mockResolvedValue(employee);
      prisma.salaryRecord.create.mockResolvedValue({});

      await service.create('emp-1', { ...dto, currency: 'USD' } as never);

      expect(prisma.salaryRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'GBP' }),
        }),
      );
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.create('missing', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.salaryRecord.create).not.toHaveBeenCalled();
    });
  });
});
