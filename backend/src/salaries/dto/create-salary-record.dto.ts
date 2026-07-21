import { IsDateString, IsEnum, IsNumber, IsPositive } from 'class-validator';
import { SalaryChangeReason } from '../../../generated/prisma/enums';

export class CreateSalaryRecordDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  effectiveDate!: string;

  @IsEnum(SalaryChangeReason)
  reason!: SalaryChangeReason;
}
