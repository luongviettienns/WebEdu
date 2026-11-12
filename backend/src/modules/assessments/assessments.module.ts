import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller.js';
import { QuestionSchemaPolicy } from './policies/question-schema.policy.js';
import { AssessmentCrudService } from './services/assessment-crud.service.js';
import { QuestionCrudService } from './services/question-crud.service.js';

@Module({
  controllers: [AssessmentsController],
  providers: [QuestionSchemaPolicy, AssessmentCrudService, QuestionCrudService],
  exports: [QuestionSchemaPolicy, AssessmentCrudService, QuestionCrudService],
})
export class AssessmentsModule {}
