import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller.js';
import { StudentAccessService } from './services/student-access.service.js';
import { StudentCrudService } from './services/student-crud.service.js';
import { StudentEnrollmentService } from './services/student-enrollment.service.js';
import { StudentQueryService } from './services/student-query.service.js';

@Module({
  controllers: [StudentsController],
  providers: [
    StudentAccessService,
    StudentQueryService,
    StudentCrudService,
    StudentEnrollmentService,
  ],
  exports: [
    StudentAccessService,
    StudentQueryService,
    StudentCrudService,
    StudentEnrollmentService,
  ],
})
export class StudentsModule {}
