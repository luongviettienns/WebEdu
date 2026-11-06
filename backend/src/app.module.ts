import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProfileModule } from './modules/users/profile.module.js';
import { TeachersModule } from './modules/teachers/teachers.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    TeachersModule,
    StudentsModule,
    SystemSettingsModule,
  ],
})
export class AppModule {}
