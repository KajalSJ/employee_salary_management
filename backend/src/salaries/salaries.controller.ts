import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { SalariesService } from './salaries.service';
import { CreateSalaryRecordDto } from './dto/create-salary-record.dto';

@Controller('employees/:employeeId/salaries')
export class SalariesController {
  constructor(private readonly salariesService: SalariesService) {}

  @Post()
  create(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateSalaryRecordDto,
  ) {
    return this.salariesService.create(employeeId, dto);
  }
}
