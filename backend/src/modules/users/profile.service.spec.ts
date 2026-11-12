import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { TokenService } from '../../common/auth/token.service.js';
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
    studentProfile: {
      dateOfBirth: Date;
      assignedClass: string | null;
      guardianEmail?: string | null;
      consent?: {
        consentedAt: Date;
        guardianEmail: string;
        consentVersion: string;
      } | null;
    } | null;
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
      $queryRaw: vi.fn(async () => []),
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
    const tokenService = new TokenService(jwtService, configService);

    service = new ProfileService(
      mockPrisma as unknown as PrismaService,
      tokenService,
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

  it('preserves immutable GuardianConsent history when student turns 16 and updates to personal email (FUNC-078)', async () => {
    // Initial state: registered at age 14 with parent's email
    userState.email = 'parent.phuhuynh@example.com';
    userState.studentProfile = {
      dateOfBirth: new Date('2010-05-15'),
      assignedClass: null,
      guardianEmail: 'parent.phuhuynh@example.com',
      consent: {
        consentedAt: new Date('2024-05-15'),
        guardianEmail: 'parent.phuhuynh@example.com',
        consentVersion: 'v1.0',
      },
    };

    // Student turns 16 and updates to their personal email
    const result = await service.updateMyProfile('u-1', {
      email: 'student.truongthanh@example.com',
      currentPassword: 'CurrentPass123',
    });

    expect(result.profile.email).toBe('student.truongthanh@example.com');
    // GuardianConsent must remain untouched and strictly preserve original parent email
    expect(userState.studentProfile?.consent?.guardianEmail).toBe(
      'parent.phuhuynh@example.com',
    );
  });

  it('maps P2002 unique violation during concurrent profile update to 409 Conflict', async () => {
    const p2002Prisma = {
      $queryRaw: vi.fn(async () => []),
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

    const raceTokenService = new TokenService(
      { signAsync: signAsyncMock } as unknown as JwtService,
      { get: vi.fn(() => 'secret') } as unknown as ConfigService,
    );
    const raceService = new ProfileService(
      p2002Prisma as unknown as PrismaService,
      raceTokenService,
    );

    await expect(
      raceService.updateMyProfile('u-1', { phone: '0909998888' }),
    ).rejects.toThrowError(new ConflictException('Email/Số điện thoại đã được sử dụng'));
  });

  it('validates currentPassword, length, confirmation, and non-reuse in changePassword and rotates session', async () => {
    await expect(
      service.changePassword('u-1', {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword@123',
      }),
    ).rejects.toThrowError(new BadRequestException('Mật khẩu hiện tại không đúng'));

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'CurrentPass123',
        newPassword: 'short',
      }),
    ).rejects.toThrowError(
      new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự'),
    );

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'CurrentPass123',
        newPassword: 'A'.repeat(73),
      }),
    ).rejects.toThrowError(
      new BadRequestException('Mật khẩu mới không được vượt quá 72 ký tự'),
    );

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'CurrentPass123',
        newPassword: 'NewPassword@123',
        confirmPassword: 'DifferentPassword@123',
      }),
    ).rejects.toThrowError(
      new BadRequestException('Xác nhận mật khẩu không khớp'),
    );

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'CurrentPass123',
        newPassword: 'CurrentPass123',
      }),
    ).rejects.toThrowError(
      new BadRequestException('Mật khẩu mới không được trùng mật khẩu hiện tại'),
    );

    const res = await service.changePassword(
      'u-1',
      {
        currentPassword: 'CurrentPass123',
        newPassword: 'NewPassword@456',
        confirmPassword: 'NewPassword@456',
      },
      { rememberMe: false },
    );
    expect(res.message).toBe('Đổi mật khẩu thành công');
    expect(res.expiresIn).toBe(3600);
    expect(userState.tokenVersion).toBe(3);
  });

  it('maps student profile dateOfBirth and isDateOfBirthReadOnly in getMyProfile and updates fullName without rotating session', async () => {
    userState.roles = [Role.STUDENT];
    userState.studentProfile = {
      dateOfBirth: new Date('2010-05-20T00:00:00.000Z'),
      assignedClass: 'HSK1-K26-01',
    };
    const studentProfile = await service.getMyProfile('u-1');
    expect(studentProfile.dateOfBirth).toBe('2010-05-20');
    expect(studentProfile.assignedClass).toBe('HSK1-K26-01');

    const res = await service.updateMyProfile('u-1', {
      fullName: 'Học Viên Đổi Tên',
    });
    expect(res.profile.fullName).toBe('Học Viên Đổi Tên');
    expect(res.rotatedSession).toBeUndefined();
  });

  it('re-verifies currentPassword inside transaction lock when passwordHash rotated concurrently', async () => {
    const newConcurrentHash = await bcrypt.hash('DifferentConcurrentPass123', 10);
    const compareSpy = vi.spyOn(bcrypt, 'hash').mockImplementationOnce(async () => {
      // Simulate concurrent resetPassword updating passwordHash while hashPassword() runs
      userState.passwordHash = newConcurrentHash;
      return '$2b$12$simulatedNewHashValue000000000000000000000000000000000';
    });

    await expect(
      service.changePassword('u-1', {
        currentPassword: 'CurrentPass123',
        newPassword: 'BrandNewPassword@456',
      }),
    ).rejects.toThrowError(new BadRequestException('Mật khẩu hiện tại không đúng'));

    compareSpy.mockRestore();
  });
});
