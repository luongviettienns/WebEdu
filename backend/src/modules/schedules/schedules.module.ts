import { Module } from '@nestjs/common';
import { SchedulesController } from './schedules.controller.js';
import { ScheduleAccessPolicy } from './policies/schedule-access.policy.js';
import { SessionGeneratorService } from './services/session-generator.service.js';
import { SessionQueryService } from './services/session-query.service.js';
import { SessionWorkflowService } from './services/session-workflow.service.js';

@Module({
  controllers: [SchedulesController],
  providers: [
    ScheduleAccessPolicy,
    SessionGeneratorService,
    SessionQueryService,
    SessionWorkflowService,
  ],
  exports: [
    ScheduleAccessPolicy,
    SessionGeneratorService,
    SessionQueryService,
    SessionWorkflowService,
  ],
})
export class SchedulesModule {}
