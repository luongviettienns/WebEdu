import { Module } from '@nestjs/common';
import { SystemSettingsController } from './system-settings.controller.js';
import { AiGradingConfigService } from './services/ai-grading-config.service.js';
import { SystemConfigService } from './services/system-config.service.js';
import { SystemUsersService } from './services/system-users.service.js';
import { UserRoleStatusService } from './services/user-role-status.service.js';

@Module({
  controllers: [SystemSettingsController],
  providers: [
    SystemUsersService,
    UserRoleStatusService,
    SystemConfigService,
    AiGradingConfigService,
  ],
  exports: [
    SystemUsersService,
    UserRoleStatusService,
    SystemConfigService,
    AiGradingConfigService,
  ],
})
export class SystemSettingsModule {}
