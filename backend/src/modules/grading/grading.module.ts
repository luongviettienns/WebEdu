import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { SystemSettingsModule } from '../system-settings/system-settings.module.js';
import { GradingController } from './grading.controller.js';
import { AutoGradingPolicy } from './policies/auto-grading.policy.js';
import { PublishedGradesRepository } from './repositories/published-grades.repository.js';
import { AiEssayGradingService } from './services/ai-essay-grading.service.js';
import { AutoGradingService } from './services/auto-grading.service.js';
import { GradeAdjustmentService } from './services/grade-adjustment.service.js';
import { GradePublicationService } from './services/grade-publication.service.js';
import { GradingEventsService } from './services/grading-events.service.js';
import { GradingTrackerService } from './services/grading-tracker.service.js';
import { TeacherGradingService } from './services/teacher-grading.service.js';

@Module({
  imports: [AssignmentsModule, SystemSettingsModule],
  controllers: [GradingController],
  providers: [
    AutoGradingPolicy,
    AutoGradingService,
    AiEssayGradingService,
    GradingEventsService,
    GradingTrackerService,
    TeacherGradingService,
    GradePublicationService,
    GradeAdjustmentService,
    PublishedGradesRepository,
  ],
  exports: [
    AutoGradingPolicy,
    AutoGradingService,
    AiEssayGradingService,
    GradingEventsService,
    GradingTrackerService,
    TeacherGradingService,
    GradePublicationService,
    GradeAdjustmentService,
    PublishedGradesRepository,
  ],
})
export class GradingModule {}
