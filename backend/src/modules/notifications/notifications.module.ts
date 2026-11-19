import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationAcademicTriggersService } from './services/notification-academic-triggers.service.js';
import { NotificationDeadlineService } from './services/notification-deadline.service.js';
import { NotificationDispatchService } from './services/notification-dispatch.service.js';
import { NotificationMaintenanceService } from './services/notification-maintenance.service.js';
import { NotificationQueryService } from './services/notification-query.service.js';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationDispatchService,
    NotificationAcademicTriggersService,
    NotificationDeadlineService,
    NotificationMaintenanceService,
    NotificationQueryService,
  ],
  exports: [
    NotificationDispatchService,
    NotificationAcademicTriggersService,
    NotificationDeadlineService,
    NotificationMaintenanceService,
    NotificationQueryService,
  ],
})
export class NotificationsModule {}
