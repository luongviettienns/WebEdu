import type { TestingModule } from '@nestjs/testing';
import { SystemConfigService } from '../../src/modules/system-settings/services/system-config.service.js';
import { SystemUsersService } from '../../src/modules/system-settings/services/system-users.service.js';
import { UserRoleStatusService } from '../../src/modules/system-settings/services/user-role-status.service.js';

export interface SystemSettingsServicesHandle {
  listSystemUsers: SystemUsersService['listSystemUsers'];
  createSystemUser: SystemUsersService['createSystemUser'];
  updateUserRolesAndStatus: UserRoleStatusService['updateUserRolesAndStatus'];
  getSystemConfig: SystemConfigService['getSystemConfig'];
  updateSystemConfig: SystemConfigService['updateSystemConfig'];
  listAuditLogs: SystemConfigService['listAuditLogs'];
}

export function resolveSystemSettingsServices(
  moduleRef: TestingModule,
): SystemSettingsServicesHandle {
  const users = moduleRef.get(SystemUsersService);
  const roleStatus = moduleRef.get(UserRoleStatusService);
  const config = moduleRef.get(SystemConfigService);

  return {
    listSystemUsers: users.listSystemUsers.bind(users),
    createSystemUser: users.createSystemUser.bind(users),
    updateUserRolesAndStatus: roleStatus.updateUserRolesAndStatus.bind(roleStatus),
    getSystemConfig: config.getSystemConfig.bind(config),
    updateSystemConfig: config.updateSystemConfig.bind(config),
    listAuditLogs: config.listAuditLogs.bind(config),
  };
}
