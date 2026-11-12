import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthLoginService } from './services/auth-login.service.js';
import { AuthMaintenanceService } from './services/auth-maintenance.service.js';
import { AuthRegistrationService } from './services/auth-registration.service.js';
import { AuthSessionService } from './services/auth-session.service.js';
import { PasswordRecoveryService } from './services/password-recovery.service.js';
import { MailModule } from '../../common/mail/mail.module.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CsrfOriginPolicy } from '../../common/guards/csrf-origin.policy.js';
import { ActivityTrackerService } from '../../common/guards/activity-tracker.service.js';
import { SessionValidatorService } from '../../common/guards/session-validator.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokenService,
} from '../../common/auth/token.service.js';

@Global()
@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    TokenService,
    CsrfOriginPolicy,
    ActivityTrackerService,
    SessionValidatorService,
    AuthSessionService,
    AuthRegistrationService,
    AuthLoginService,
    PasswordRecoveryService,
    AuthMaintenanceService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    TokenService,
    CsrfOriginPolicy,
    ActivityTrackerService,
    SessionValidatorService,
    AuthSessionService,
    AuthRegistrationService,
    AuthLoginService,
    PasswordRecoveryService,
    AuthMaintenanceService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
