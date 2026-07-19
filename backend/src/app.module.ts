import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeesModule } from './employees/employees.module';
import { SalariesModule } from './salaries/salaries.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [EmployeesModule, SalariesModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
