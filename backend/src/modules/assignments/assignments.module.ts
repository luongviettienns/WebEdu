import { Module } from '@nestjs/common';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { AssignmentsController } from './assignments.controller.js';
import { AssignmentAccessPolicy } from './policies/assignment-access.policy.js';
import { SubmissionAnswerPolicy } from './policies/submission-answer.policy.js';
import { AssignmentDeliveryService } from './services/assignment-delivery.service.js';
import { StudentSubmissionService } from './services/student-submission.service.js';

@Module({
  imports: [AssessmentsModule],
  controllers: [AssignmentsController],
  providers: [
    AssignmentAccessPolicy,
    SubmissionAnswerPolicy,
    AssignmentDeliveryService,
    StudentSubmissionService,
  ],
  exports: [
    AssignmentAccessPolicy,
    SubmissionAnswerPolicy,
    AssignmentDeliveryService,
    StudentSubmissionService,
  ],
})
export class AssignmentsModule {}
