import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { EmployeeStatus } from '../../generated/prisma/enums';

type PrismaMock = {
  employee: {
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function knownRequestError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '7.8.0',
  });
}

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: PrismaMock;

  const employee = {
    id: 'emp-1',
    name: 'Ada Lovelace',
    email: 'ada@acme.com',
    department: 'Engineering',
    country: 'United Kingdom',
    currency: 'GBP',
    jobTitle: 'Senior Software Engineer',
    status: EmployeeStatus.ACTIVE,
    hireDate: new Date('2020-01-01'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('applies default pagination and an empty filter', async () => {
      prisma.employee.findMany.mockResolvedValue([employee]);
      prisma.employee.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, where: {} }),
      );
      expect(result).toEqual({
        data: [employee],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    });

    it('computes skip/take for later pages', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(45);

      const result = await service.findAll({ page: 3, pageSize: 10 });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toEqual({
        page: 3,
        pageSize: 10,
        total: 45,
        totalPages: 5,
      });
    });

    it('rounds totalPages up and floors it at 1 with no results', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, pageSize: 20 });

      expect(result).toEqual({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      });
    });

    it('filters by department, country, and status together', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        pageSize: 20,
        department: 'Engineering',
        country: 'India',
        status: EmployeeStatus.TERMINATED,
      });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            department: 'Engineering',
            country: 'India',
            status: EmployeeStatus.TERMINATED,
          },
        }),
      );
      expect(prisma.employee.count).toHaveBeenCalledWith({
        where: {
          department: 'Engineering',
          country: 'India',
          status: EmployeeStatus.TERMINATED,
        },
      });
    });

    it('searches by name using a case-insensitive contains match', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 20, search: 'ada' });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: { contains: 'ada', mode: Prisma.QueryMode.insensitive },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the employee with salary history included, ordered by effectiveDate', async () => {
      const withHistory = { ...employee, salaryRecords: [{ id: 'sal-1' }] };
      prisma.employee.findUnique.mockResolvedValue(withHistory);

      const result = await service.findOne('emp-1');

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        include: { salaryRecords: { orderBy: { effectiveDate: 'asc' } } },
      });
      expect(result).toBe(withHistory);
    });

    it('throws NotFoundException when no employee matches the id', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException (not a crash) for a malformed id', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('not-a-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Grace Hopper',
      email: 'grace@acme.com',
      department: 'Engineering',
      country: 'United States',
      currency: 'USD',
      jobTitle: 'Staff Software Engineer',
      hireDate: '2024-01-15',
    };

    it('creates an employee, converting hireDate to a Date', async () => {
      prisma.employee.create.mockResolvedValue({ ...employee, ...dto });

      await service.create(dto);

      expect(prisma.employee.create).toHaveBeenCalledWith({
        data: { ...dto, hireDate: new Date(dto.hireDate) },
      });
    });

    it('throws ConflictException when the email is already taken', async () => {
      prisma.employee.create.mockRejectedValue(
        knownRequestError('P2002', 'Unique constraint failed'),
      );

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('rethrows errors it does not recognize', async () => {
      prisma.employee.create.mockRejectedValue(new Error('boom'));

      await expect(service.create(dto)).rejects.toThrow('boom');
    });
  });

  describe('update', () => {
    it('updates only the fields provided', async () => {
      prisma.employee.update.mockResolvedValue({
        ...employee,
        jobTitle: 'Principal Engineer',
      });

      await service.update('emp-1', { jobTitle: 'Principal Engineer' });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { jobTitle: 'Principal Engineer' },
      });
    });

    it('converts hireDate to a Date when present', async () => {
      prisma.employee.update.mockResolvedValue(employee);

      await service.update('emp-1', { hireDate: '2021-06-01' });

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { hireDate: new Date('2021-06-01') },
      });
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      prisma.employee.update.mockRejectedValue(
        knownRequestError('P2025', 'Record to update not found'),
      );

      await expect(
        service.update('missing', { jobTitle: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the new email is already in use', async () => {
      prisma.employee.update.mockRejectedValue(
        knownRequestError('P2002', 'Unique constraint failed'),
      );

      await expect(
        service.update('emp-1', { email: 'taken@acme.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting status to TERMINATED instead of deleting the row', async () => {
      prisma.employee.update.mockResolvedValue({
        ...employee,
        status: EmployeeStatus.TERMINATED,
      });

      const result = await service.remove('emp-1');

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { status: EmployeeStatus.TERMINATED },
      });
      expect(result.status).toBe(EmployeeStatus.TERMINATED);
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      prisma.employee.update.mockRejectedValue(
        knownRequestError('P2025', 'Record to update not found'),
      );

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
