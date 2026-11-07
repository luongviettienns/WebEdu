import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthLoginService } from './services/auth-login.service.js';
import { AuthRegistrationService } from './services/auth-registration.service.js';
import { AuthSessionService } from './services/auth-session.service.js';
import { PasswordRecoveryService } from './services/password-recovery.service.js';
import { MailModule } from '../../common/mail/mail.module.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@Global()
@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: 3600 },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthSessionService,
    AuthRegistrationService,
    AuthLoginService,
    PasswordRecoveryService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthSessionService,
    AuthRegistrationService,
    AuthLoginService,
    PasswordRecoveryService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
