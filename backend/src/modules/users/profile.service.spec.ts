import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ProfileService } from './profile.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

describe('ProfileService (FUNC-078)', () => {
  let service: ProfileService;
  let signAsyncMock: ReturnType<typeof vi.fn>;
  let auditLogs: Array<Record<string, unknown>>;
  let userState: {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    passwordHash: string;
    roles: Role[];
    status: UserStatus;
    tokenVersion: number;
    studentProfile: { dateOfBirth: Date; assignedClass: string | null } | null;
    teacherProfile: { activeClassesCount: number } | null;
    _count: { taughtClasses: number };
  };

  beforeEach(async () => {
    auditLogs = [];
    userState = {
      id: 'u-1',
      email: 'teacher@webedu.vn',
      phone: '0901234567',
      fullName: 'Cô Giáo Hoa',
      passwordHash: await bcrypt.hash('CurrentPass123', 10),
      roles: [Role.TEACHER],
      status: UserStatus.ACTIVE,
      tokenVersion: 2,
      studentProfile: null,
      teacherProfile: { activeClassesCount: 0 },
      _count: { taughtClasses: 2 },
    };

    const mockPrisma = {
      user: {
        findUnique: vi.fn(async () => userState),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (typeof data.fullName === 'string') userState.fullName = data.fullName;
          if (typeof data.phone === 'string') userState.phone = data.phone;
          if (typeof data.email === 'string') userState.email = data.email;
          if (typeof data.passwordHash === 'string') userState.passwordHash = data.passwordHash;
          if (
            data.tokenVersion &&
            typeof data.tokenVersion === 'object' &&
            'increment' in data.tokenVersion
          ) {
            userState.tokenVersion += Number(
              (data.tokenVersion as { increment: number }).increment,
            );
          }
          return userState;
        }),
      },
      systemAuditLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          auditLogs.push(data);
          return data;
        }),
      },
      $transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
        cb(mockPrisma),
      ),
    };

    signAsyncMock = vi.fn().mockResolvedValue('fresh-cookie-jwt');
    const jwtService = { signAsync: signAsyncMock } as unknown as JwtService;
    const configService = {
      get: vi.fn(() => 'test-jwt-secret-key-minimum-32-chars'),
    } as unknown as ConfigService;

    service = new ProfileService(
      mockPrisma as unknown as PrismaService,
      jwtService,
      configService,
    );
  });

  it('returns real activeClassesCount on getMyProfile for TEACHER accounts', async () => {
    const me = await service.getMyProfile('u-1');
    expect(me.activeClassesCount).toBe(2);
  });

  it('forbids self-editing dateOfBirth, writes audit log in $transaction, and preserves rememberMe TTL on email change', async () => {
    await expect(
      service.updateMyProfile('u-1', { dateOfBirth: '2000-01-01' }),
    ).rejects.toThrowError(
      new BadRequestException('Học viên không được phép tự sửa ngày sinh'),
    );

    const updated = await service.updateMyProfile(
      'u-1',
      {
        email: 'hoa.new@webedu.vn',
        currentPassword: 'CurrentPass123',
      },
      { rememberMe: true },
    );

    expect(updated.profile.email).toBe('hoa.new@webedu.vn');
    expect(updated.rotatedSession?.expiresIn).toBe(7 * 24 * 60 * 60);
    expect(userState.tokenVersion).toBe(3);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.action).toBe('UPDATE_MY_PROFILE');
  });

  it('maps P2002 unique violation during concurrent profile update to 409 Conflict', async () => {
    const p2002Prisma = {
      user: {
        findUnique: vi.fn(async () => userState),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }),
      },
      systemAuditLog: { create: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
        cb(p2002Prisma),
      ),
    };

    const raceService = new ProfileService(
      p2002Prisma as unknown as PrismaService,
      { signAsync: signAsyncMock } as unknown as JwtService,
      { get: vi.fn(() => 'secret') } as unknown as ConfigService,
    );

    await expect(
      raceService.updateMyProfile('u-1', { phone: '0909998888' }),
    ).rejects.toThrowError(new ConflictException('Email/Số điện thoại đã được sử dụng'));
  });
});
