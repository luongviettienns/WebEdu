import { Module } from '@nestjs/common';
import { SystemSettingsController } from './system-settings.controller.js';
import { SystemConfigService } from './services/system-config.service.js';
import { SystemUsersService } from './services/system-users.service.js';
import { UserRoleStatusService } from './services/user-role-status.service.js';

@Module({
  controllers: [SystemSettingsController],
  providers: [SystemUsersService, UserRoleStatusService, SystemConfigService],
  exports: [SystemUsersService, UserRoleStatusService, SystemConfigService],
})
export class SystemSettingsModule {}
