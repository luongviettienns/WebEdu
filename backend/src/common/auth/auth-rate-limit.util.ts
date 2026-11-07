import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismaService } from '../prisma/prisma.service.js';

export interface RateLimitOptions {
  key: string;
  maxPoints: number;
  windowMs: number;
  blockDurationMs: number;
  errorMessage?: string;
}

export interface RateLimitRecord {
  key: string;
  points: number;
  last_attempt_at: Date;
  blocked_until: Date | null;
}

export function resolveClientIp(req: Request): string {
  let ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip.slice(0, 64);
}

/**
 * Multi-instance safe rate limiter powered by PostgreSQL atomic upsert.
 * Enforces sliding/fixed window and block duration across any number of app instances.
 */
export async function assertRateLimitNotExceeded(
  prisma: PrismaService,
  options: RateLimitOptions,
): Promise<void> {
  const {
    key,
    maxPoints,
    windowMs,
    blockDurationMs,
    errorMessage = 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau',
  } = options;

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const blockUntil = new Date(now.getTime() + blockDurationMs);

  const rows = await prisma.$queryRaw<RateLimitRecord[]>`
    INSERT INTO "auth_rate_limits" ("key", "points", "last_attempt_at", "blocked_until")
    VALUES (${key}, 1, ${now}, NULL)
    ON CONFLICT ("key") DO UPDATE
      SET
        "points" = CASE
          WHEN "auth_rate_limits"."blocked_until" IS NOT NULL AND "auth_rate_limits"."blocked_until" > ${now}
            THEN "auth_rate_limits"."points"
          WHEN "auth_rate_limits"."blocked_until" IS NOT NULL AND "auth_rate_limits"."blocked_until" <= ${now}
            THEN 1
          WHEN "auth_rate_limits"."last_attempt_at" < ${windowStart}
            THEN 1
          ELSE "auth_rate_limits"."points" + 1
        END,
        "blocked_until" = CASE
          WHEN "auth_rate_limits"."blocked_until" IS NOT NULL AND "auth_rate_limits"."blocked_until" > ${now}
            THEN "auth_rate_limits"."blocked_until"
          WHEN "auth_rate_limits"."blocked_until" IS NOT NULL AND "auth_rate_limits"."blocked_until" <= ${now}
            THEN NULL
          WHEN "auth_rate_limits"."last_attempt_at" >= ${windowStart} AND ("auth_rate_limits"."points" + 1) > ${maxPoints}
            THEN ${blockUntil}
          ELSE NULL
        END,
        "last_attempt_at" = ${now}
    RETURNING "key", "points", "last_attempt_at", "blocked_until"
  `;

  const record = rows[0];
  if (
    record &&
    record.blocked_until &&
    new Date(record.blocked_until).getTime() > now.getTime()
  ) {
    throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Fast read-check to reject requests immediately if the key is already blocked.
 */
export async function assertIpNotBlocked(
  prisma: PrismaService,
  key: string,
  errorMessage = 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau',
): Promise<void> {
  const now = new Date();
  const rows = await prisma.$queryRaw<Array<{ blocked_until: Date | null }>>`
    SELECT "blocked_until" FROM "auth_rate_limits"
    WHERE "key" = ${key} AND "blocked_until" > ${now}
    LIMIT 1
  `;
  if (rows.length > 0) {
    throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Opportunistically prunes expired rate-limit records without holding long locks.
 */
export async function pruneStaleRateLimits(
  prisma: PrismaService,
  retentionMs = 24 * 60 * 60 * 1000,
): Promise<void> {
  const cutoff = new Date(Date.now() - retentionMs);
  await prisma.$executeRaw`
    DELETE FROM "auth_rate_limits"
    WHERE "key" IN (
      SELECT "key" FROM "auth_rate_limits"
      WHERE "last_attempt_at" < ${cutoff}
        AND ("blocked_until" IS NULL OR "blocked_until" < CURRENT_TIMESTAMP)
      LIMIT 500
    )
  `;
}

/**
 * Resets/clears the rate limit record for a key upon successful action (e.g. successful login).
 */
export async function resetRateLimitKey(
  prisma: PrismaService,
  key: string,
): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM "auth_rate_limits"
    WHERE "key" = ${key}
  `;
}
