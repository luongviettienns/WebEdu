import type { TestingModule } from '@nestjs/testing';
import { AuthLoginService } from '../../src/modules/auth/services/auth-login.service.js';
import { AuthMaintenanceService } from '../../src/modules/auth/services/auth-maintenance.service.js';
import { AuthRegistrationService } from '../../src/modules/auth/services/auth-registration.service.js';
import { AuthSessionService } from '../../src/modules/auth/services/auth-session.service.js';
import { PasswordRecoveryService } from '../../src/modules/auth/services/password-recovery.service.js';

export interface AuthServicesHandle {
  sendVerificationCode: AuthRegistrationService['sendVerificationCode'];
  register: AuthRegistrationService['register'];
  login: AuthLoginService['login'];
  getMe: AuthSessionService['getMe'];
  logout: AuthSessionService['logout'];
  forgotPassword: PasswordRecoveryService['forgotPassword'];
  resetPassword: PasswordRecoveryService['resetPassword'];
  maintenance: AuthMaintenanceService;
}

export function resolveAuthServices(
  moduleRef: TestingModule,
): AuthServicesHandle {
  const registration = moduleRef.get(AuthRegistrationService);
  const login = moduleRef.get(AuthLoginService);
  const session = moduleRef.get(AuthSessionService);
  const recovery = moduleRef.get(PasswordRecoveryService);
  const maintenance = moduleRef.get(AuthMaintenanceService);

  return {
    sendVerificationCode:
      registration.sendVerificationCode.bind(registration),
    register: registration.register.bind(registration),
    login: login.login.bind(login),
    getMe: session.getMe.bind(session),
    logout: session.logout.bind(session),
    forgotPassword: recovery.forgotPassword.bind(recovery),
    resetPassword: recovery.resetPassword.bind(recovery),
    maintenance,
  };
}
