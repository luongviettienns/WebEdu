import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service.js';

const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours past expiry/activity

export interface AuthCleanupSummary {
  deletedResetTokens: number;
  deletedEmailVerifications: number;
  deletedEmailRateLimits: number;
  deletedAuthRateLimits: number;
}

/**
 * Deterministic background maintenance service for auth ephemeral tables:
 * prunes expired `password_reset_tokens`, `email_verifications`, `email_rate_limits`,
 * and `auth_rate_limits` on an unref'd schedule instead of ad-hoc random sampling.
 */
@Injectable()
export class AuthMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthMaintenanceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.purgeExpiredAuthData().catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Scheduled auth table cleanup failed: ${reason}`);
      });
    }, DEFAULT_CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async purgeExpiredAuthData(
    retentionMs = DEFAULT_RETENTION_MS,
  ): Promise<AuthCleanupSummary> {
    const cutoff = new Date(Date.now() - retentionMs);

    const [
      deletedResetTokens,
      deletedEmailVerifications,
      deletedEmailRateLimits,
      deletedAuthRateLimits,
    ] = await Promise.all([
      this.prisma.$executeRaw`
        DELETE FROM "password_reset_tokens"
        WHERE "id" IN (
          SELECT "id" FROM "password_reset_tokens"
          WHERE "expires_at" < ${cutoff}
          LIMIT 1000
        )
      `,
      this.prisma.$executeRaw`
        DELETE FROM "email_verifications"
        WHERE "id" IN (
          SELECT "id" FROM "email_verifications"
          WHERE "expires_at" < ${cutoff}
          LIMIT 1000
        )
      `,
      this.prisma.$executeRaw`
        DELETE FROM "email_rate_limits"
        WHERE "email_hash" IN (
          SELECT "email_hash" FROM "email_rate_limits"
          WHERE "last_requested_at" < ${cutoff}
          LIMIT 1000
        )
      `,
      this.prisma.$executeRaw`
        DELETE FROM "auth_rate_limits"
        WHERE "key" IN (
          SELECT "key" FROM "auth_rate_limits"
          WHERE "last_attempt_at" < ${cutoff}
            AND ("blocked_until" IS NULL OR "blocked_until" < ${cutoff})
          LIMIT 1000
        )
      `,
    ]);

    return {
      deletedResetTokens: Number(deletedResetTokens),
      deletedEmailVerifications: Number(deletedEmailVerifications),
      deletedEmailRateLimits: Number(deletedEmailRateLimits),
      deletedAuthRateLimits: Number(deletedAuthRateLimits),
    };
  }
}
