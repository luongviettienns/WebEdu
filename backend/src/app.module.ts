import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProfileModule } from './modules/users/profile.module.js';
import { TeachersModule } from './modules/teachers/teachers.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { ClassesModule } from './modules/classes/classes.module.js';
import { SchedulesModule } from './modules/schedules/schedules.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { AssessmentsModule } from './modules/assessments/assessments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: process.env.NODE_ENV === 'test' ? 2000 : 120,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    TeachersModule,
    StudentsModule,
    SystemSettingsModule,
    CoursesModule,
    ClassesModule,
    SchedulesModule,
    AttendanceModule,
    AssessmentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
