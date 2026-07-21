import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryRecordDto } from './dto/create-salary-record.dto';

@Injectable()
export class SalariesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Always inserts a new SalaryRecord row (never updates an existing one),
   * preserving full compensation history. currency is derived from the
   * employee's own currency rather than accepted from the client, since
   * SalaryRecord.currency is expected to always match Employee.currency
   * (see analytics' currency-segmented reporting).
   */
  async create(employeeId: string, dto: CreateSalaryRecordDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with id "${employeeId}" not found`);
    }

    return this.prisma.salaryRecord.create({
      data: {
        employeeId,
        amount: dto.amount,
        currency: employee.currency,
        effectiveDate: new Date(dto.effectiveDate),
        reason: dto.reason,
      },
    });
  }
}
