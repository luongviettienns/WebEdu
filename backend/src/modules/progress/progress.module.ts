import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { ClassesModule } from '../classes/classes.module.js';
import { ProgressController } from './progress.controller.js';
import { AdminOverviewService } from './services/admin-overview.service.js';
import { ClassProgressService } from './services/class-progress.service.js';
import { StudentProgressService } from './services/student-progress.service.js';

@Module({
  imports: [AttendanceModule, ClassesModule],
  controllers: [ProgressController],
  providers: [StudentProgressService, ClassProgressService, AdminOverviewService],
  exports: [StudentProgressService, ClassProgressService, AdminOverviewService],
})
export class ProgressModule {}
