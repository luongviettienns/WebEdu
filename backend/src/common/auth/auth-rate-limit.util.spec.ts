import { describe, it, expect, vi, afterEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  assertIpNotBlocked,
  assertRateLimitNotExceeded,
  pruneStaleRateLimits,
  resetRateLimitKey,
  resolveClientIp,
} from './auth-rate-limit.util.js';

describe('auth-rate-limit.util', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves client IP, strips IPv4-mapped IPv6 prefix ::ffff:, and truncates at 64 chars', () => {
    expect(
      resolveClientIp({ ip: '::ffff:192.168.1.25' } as unknown as Request),
    ).toBe('192.168.1.25');

    expect(
      resolveClientIp({
        ip: '',
        socket: { remoteAddress: '10.0.0.9' },
      } as unknown as Request),
    ).toBe('10.0.0.9');

    expect(resolveClientIp({} as unknown as Request)).toBe('unknown');

    const longIp = 'a'.repeat(80);
    expect(resolveClientIp({ ip: longIp } as unknown as Request)).toHaveLength(64);
  });

  it('allows requests under rate limit, handles boundary timestamps, and throws 429 when blocked_until > now', async () => {
    vi.useFakeTimers();
    const fixedNow = new Date('2026-04-06T12:00:00.000Z');
    vi.setSystemTime(fixedNow);

    const queryRawMock = vi
      .fn()
      // 1. Empty rows
      .mockResolvedValueOnce([])
      // 2. Null blocked_until
      .mockResolvedValueOnce([
        {
          key: 'login:ip:127.0.0.1',
          points: 1,
          last_attempt_at: fixedNow,
          blocked_until: null,
        },
      ])
      // 3. Exact boundary blocked_until === now (must NOT throw)
      .mockResolvedValueOnce([
        {
          key: 'login:ip:127.0.0.1',
          points: 10,
          last_attempt_at: fixedNow,
          blocked_until: new Date(fixedNow.getTime()),
        },
      ])
      // 4. Blocked in future with default error message
      .mockResolvedValueOnce([
        {
          key: 'login:ip:127.0.0.1',
          points: 11,
          last_attempt_at: fixedNow,
          blocked_until: new Date(fixedNow.getTime() + 1),
        },
      ])
      // 5. Blocked in future with custom error message
      .mockResolvedValueOnce([
        {
          key: 'login:ip:127.0.0.1',
          points: 12,
          last_attempt_at: fixedNow,
          blocked_until: new Date(fixedNow.getTime() + 60_000),
        },
      ]);

    const prismaMock = {
      $queryRaw: queryRawMock,
    } as unknown as PrismaService;

    await expect(
      assertRateLimitNotExceeded(prismaMock, {
        key: 'login:ip:127.0.0.1',
        maxPoints: 10,
        windowMs: 15_000,
        blockDurationMs: 90_000,
      }),
    ).resolves.toBeUndefined();

    // Verify windowStart (now - windowMs) and blockUntil (now + blockDurationMs) passed to SQL
    const firstCallArgs = queryRawMock.mock.calls[0] ?? [];
    expect(firstCallArgs).toContainEqual(new Date(fixedNow.getTime() - 15_000));
    expect(firstCallArgs).toContainEqual(new Date(fixedNow.getTime() + 90_000));

    await expect(
      assertRateLimitNotExceeded(prismaMock, {
        key: 'login:ip:127.0.0.1',
        maxPoints: 10,
        windowMs: 60_000,
        blockDurationMs: 60_000,
      }),
    ).resolves.toBeUndefined();

    await expect(
      assertRateLimitNotExceeded(prismaMock, {
        key: 'login:ip:127.0.0.1',
        maxPoints: 10,
        windowMs: 60_000,
        blockDurationMs: 60_000,
      }),
    ).resolves.toBeUndefined();

    await expect(
      assertRateLimitNotExceeded(prismaMock, {
        key: 'login:ip:127.0.0.1',
        maxPoints: 10,
        windowMs: 60_000,
        blockDurationMs: 60_000,
      }),
    ).rejects.toThrow(
      new HttpException(
        'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    await expect(
      assertRateLimitNotExceeded(prismaMock, {
        key: 'login:ip:127.0.0.1',
        maxPoints: 10,
        windowMs: 60_000,
        blockDurationMs: 60_000,
        errorMessage: 'IP bị chặn tạm thời',
      }),
    ).rejects.toThrow(
      new HttpException('IP bị chặn tạm thời', HttpStatus.TOO_MANY_REQUESTS),
    );
  });

  it('checks assertIpNotBlocked, pruneStaleRateLimits (default & custom retention), and resetRateLimitKey', async () => {
    vi.useFakeTimers();
    const fixedNow = new Date('2026-04-06T12:00:00.000Z');
    vi.setSystemTime(fixedNow);

    const queryRawMock = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ blocked_until: new Date(fixedNow.getTime() + 30_000) }])
      .mockResolvedValueOnce([{ blocked_until: new Date(fixedNow.getTime() + 30_000) }]);
    const executeRawMock = vi.fn().mockResolvedValue(1);
    const prismaMock = {
      $queryRaw: queryRawMock,
      $executeRaw: executeRawMock,
    } as unknown as PrismaService;

    await expect(
      assertIpNotBlocked(prismaMock, 'login:ip:1.2.3.4'),
    ).resolves.toBeUndefined();
    expect(String(queryRawMock.mock.calls[0]?.[0]?.join(' '))).toContain(
      'SELECT "blocked_until" FROM "auth_rate_limits"',
    );

    // Default error message on assertIpNotBlocked
    await expect(
      assertIpNotBlocked(prismaMock, 'login:ip:1.2.3.4'),
    ).rejects.toThrow(
      new HttpException(
        'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    // Custom error message on assertIpNotBlocked
    await expect(
      assertIpNotBlocked(prismaMock, 'login:ip:1.2.3.4', 'Đã khóa IP'),
    ).rejects.toThrow(
      new HttpException('Đã khóa IP', HttpStatus.TOO_MANY_REQUESTS),
    );

    // Default 24h retentionMs = 86_400_000
    await pruneStaleRateLimits(prismaMock);
    expect(executeRawMock.mock.calls[0]).toContainEqual(
      new Date(fixedNow.getTime() - 24 * 60 * 60 * 1000),
    );
    expect(String(executeRawMock.mock.calls[0]?.[0]?.join(' '))).toContain(
      'DELETE FROM "auth_rate_limits"',
    );

    await resetRateLimitKey(prismaMock, 'login:ip:1.2.3.4');
    expect(String(executeRawMock.mock.calls[1]?.[0]?.join(' '))).toContain(
      'DELETE FROM "auth_rate_limits"',
    );
    expect(executeRawMock).toHaveBeenCalledTimes(2);
  });
});
