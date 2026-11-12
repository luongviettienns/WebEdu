import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { AttendancePolicy } from './policies/attendance.policy.js';
import { AttendanceCrudService } from './services/attendance-crud.service.js';
import { AttendanceQueryService } from './services/attendance-query.service.js';

@Module({
  controllers: [AttendanceController],
  providers: [AttendancePolicy, AttendanceQueryService, AttendanceCrudService],
  exports: [AttendancePolicy, AttendanceQueryService, AttendanceCrudService],
})
export class AttendanceModule {}
