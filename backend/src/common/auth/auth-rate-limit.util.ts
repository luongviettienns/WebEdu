import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismaService } from '../prisma/prisma.service.js';

export interface RateLimitOptions {
  key: string;
  maxPoints: number;
  windowMs: number;
  blockDurationMs: number;
  errorMessage?: string;
  fixedWindow?: boolean;
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

export async function assertRateLimitNotBlocked(
  prisma: PrismaService,
  key: string,
  errorMessage: string,
): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ blocked_until: Date }>>`
    SELECT "blocked_until" FROM "auth_rate_limits"
    WHERE "key" = ${key} AND "blocked_until" > ${new Date()}
  `;
  if (rows.length > 0) throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
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
    fixedWindow = false,
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
        "last_attempt_at" = CASE
          WHEN ${fixedWindow} AND "auth_rate_limits"."blocked_until" IS NULL
            AND "auth_rate_limits"."last_attempt_at" >= ${windowStart}
            THEN "auth_rate_limits"."last_attempt_at"
          ELSE ${now}
        END
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
 * Atomically enforces a per-email cooldown using `email_rate_limits` conditional upsert.
 */
export async function acquireEmailCooldownOrThrow(
  prisma: PrismaService,
  emailHash: string,
  cooldownMs: number,
  errorMessage: string,
  now = new Date(),
): Promise<void> {
  const cutoff = new Date(now.getTime() - cooldownMs);
  const allowedRows = await prisma.$queryRaw<Array<{ email_hash: string }>>`
    INSERT INTO "email_rate_limits" ("email_hash", "last_requested_at")
    VALUES (${emailHash}, ${now})
    ON CONFLICT ("email_hash") DO UPDATE
      SET "last_requested_at" = EXCLUDED."last_requested_at"
      WHERE "email_rate_limits"."last_requested_at" <= ${cutoff}
    RETURNING "email_hash"
  `;

  if (allowedRows.length === 0) {
    throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
  }
}
