import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Employee, Prisma } from '../../generated/prisma/client';
import { EmployeeStatus } from '../../generated/prisma/enums';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryEmployeesDto): Promise<PaginatedResult<Employee>> {
    const { page, pageSize, department, country, status, search } = query;

    const where: Prisma.EmployeeWhereInput = {
      ...(department && { department }),
      ...(country && { country }),
      ...(status && { status }),
      ...(search && {
        name: { contains: search, mode: Prisma.QueryMode.insensitive },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { salaryRecords: { orderBy: { effectiveDate: 'asc' } } },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with id "${id}" not found`);
    }

    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    try {
      return await this.prisma.employee.create({
        data: {
          ...dto,
          hireDate: new Date(dto.hireDate),
        },
      });
    } catch (error) {
      this.mapPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const { hireDate, ...rest } = dto;

    try {
      return await this.prisma.employee.update({
        where: { id },
        data: {
          ...rest,
          ...(hireDate && { hireDate: new Date(hireDate) }),
        },
      });
    } catch (error) {
      this.mapPrismaError(error, id);
    }
  }

  /**
   * Soft-delete: sets status to TERMINATED rather than removing the row.
   * SalaryRecord.employeeId uses onDelete: Restrict, so a hard delete would
   * fail anyway once an employee has salary history — status is the
   * intended offboarding path (see CLAUDE.md data model notes).
   */
  async remove(id: string): Promise<Employee> {
    try {
      return await this.prisma.employee.update({
        where: { id },
        data: { status: EmployeeStatus.TERMINATED },
      });
    } catch (error) {
      this.mapPrismaError(error, id);
    }
  }

  private mapPrismaError(error: unknown, id?: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'An employee with this email already exists',
        );
      }
      if (error.code === 'P2025') {
        throw new NotFoundException(
          id ? `Employee with id "${id}" not found` : 'Employee not found',
        );
      }
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error', { cause: error });
  }
}
