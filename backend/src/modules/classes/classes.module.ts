import { Module } from '@nestjs/common';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { ClassesController } from './classes.controller.js';
import { ClassAccessService } from './services/class-access.service.js';
import { ClassQueryService } from './services/class-query.service.js';
import { ClassCrudService } from './services/class-crud.service.js';
import { ClassEnrollmentService } from './services/class-enrollment.service.js';
import { ClassLifecycleService } from './services/class-lifecycle.service.js';

@Module({
  imports: [SchedulesModule],
  controllers: [ClassesController],
  providers: [
    ClassAccessService,
    ClassQueryService,
    ClassCrudService,
    ClassEnrollmentService,
    ClassLifecycleService,
  ],
  exports: [
    ClassAccessService,
    ClassQueryService,
    ClassCrudService,
    ClassEnrollmentService,
    ClassLifecycleService,
  ],
})
export class ClassesModule {}
