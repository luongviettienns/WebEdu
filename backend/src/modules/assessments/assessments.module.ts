import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller.js';
import { QuestionSchemaPolicy } from './policies/question-schema.policy.js';
import { AssessmentCrudService } from './services/assessment-crud.service.js';
import { DocumentImportService } from './services/document-import.service.js';
import { QuestionCrudService } from './services/question-crud.service.js';

@Module({
  controllers: [AssessmentsController],
  providers: [QuestionSchemaPolicy, AssessmentCrudService, QuestionCrudService, DocumentImportService],
  exports: [QuestionSchemaPolicy, AssessmentCrudService, QuestionCrudService, DocumentImportService],
})
export class AssessmentsModule {}
