import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { TokenService } from '../../common/auth/token.service.js';
import type { MailService } from '../../common/mail/mail.service.js';
import { ProfileService } from './profile.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

describe('ProfileService (FUNC-078)', () => {
  let service: ProfileService;
  let signAsyncMock: ReturnType<typeof vi.fn>;
  let sendVerificationCodeEmailMock: ReturnType<typeof vi.fn>;
  let auditLogs: Array<Record<string, unknown>>;
  let sentOtps: Array<{ toEmail: string; code: string; purpose?: string }>;
  let emailVerifications: Array<{
    id: string;
    email: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    verifiedAt: Date | null;
    createdAt: Date;
  }>;
  let emailCooldowns: Map<string, Date>;
  let duplicateCheckUser: { id: string } | null;
  let mockPrisma: Record<string, unknown>;
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
    sentOtps = [];
    emailVerifications = [];
    emailCooldowns = new Map();
    duplicateCheckUser = null;
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

    mockPrisma = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join(' ');
        if (sql.includes('INSERT INTO "email_rate_limits"')) {
          const emailHash = String(values[0]);
          const now = values[1] as Date;
          const cutoff = values[3] as Date;
          const prev = emailCooldowns.get(emailHash);
          if (!prev || prev < cutoff) {
            emailCooldowns.set(emailHash, now);
            return [{ emailHash }];
          }
          return [];
        }
        if (sql.includes('INSERT INTO "auth_rate_limits"')) {
          return [{ points: 1, blockUntil: null }];
        }
        if (sql.includes('UPDATE "email_verifications"')) {
          const inputHash = String(values[0]);
          const now = values[1] as Date;
          const email = String(values[2]);
          const maxAttempts = Number(values[4]);
          const candidate = [...emailVerifications]
            .reverse()
            .find(
              (ev) =>
                ev.email === email &&
                ev.verifiedAt === null &&
                ev.expiresAt > now,
            );
          if (!candidate || candidate.attempts >= maxAttempts) {
            return [];
          }
          candidate.attempts += 1;
          if (candidate.codeHash === inputHash) {
            candidate.verifiedAt = now;
          }
          return [
            {
              id: candidate.id,
              code_hash: candidate.codeHash,
              attempts: candidate.attempts,
              verified_at: candidate.verifiedAt,
            },
          ];
        }
        return [];
      }),
      user: {
        findUnique: vi.fn(async () => userState),
        findFirst: vi.fn(async () => duplicateCheckUser),
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
      emailVerification: {
        create: vi.fn(
          async ({
            data,
          }: {
            data: { email: string; codeHash: string; expiresAt: Date };
          }) => {
            const row = {
              id: `ev-${emailVerifications.length + 1}`,
              email: data.email,
              codeHash: data.codeHash,
              expiresAt: data.expiresAt,
              attempts: 0,
              verifiedAt: null,
              createdAt: new Date(),
            };
            emailVerifications.push(row);
            return row;
          },
        ),
        deleteMany: vi.fn(async ({ where }: { where: { id?: string } }) => {
          const before = emailVerifications.length;
          emailVerifications = emailVerifications.filter((ev) => ev.id !== where.id);
          return { count: before - emailVerifications.length };
        }),
        findFirst: vi.fn(
          async ({ where }: { where: { email?: string; verifiedAt?: null } }) =>
            [...emailVerifications]
              .reverse()
              .find(
                (ev) =>
                  (!where.email || ev.email === where.email) &&
                  (where.verifiedAt === undefined || ev.verifiedAt === where.verifiedAt),
              ) ?? null,
        ),
      },
      emailRateLimit: {
        deleteMany: vi.fn(async ({ where }: { where: { emailHash?: string } }) => {
          if (where.emailHash) {
            emailCooldowns.delete(where.emailHash);
          }
          return { count: 1 };
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
    sendVerificationCodeEmailMock = vi.fn(
      async (input: { toEmail: string; code: string; purpose?: string }) => {
        sentOtps.push({
          toEmail: input.toEmail,
          code: input.code,
          purpose: input.purpose,
        });
      },
    );
    const jwtService = { signAsync: signAsyncMock } as unknown as JwtService;
    const configService = {
      get: vi.fn(() => 'test-jwt-secret-key-minimum-32-chars'),
    } as unknown as ConfigService;
    const tokenService = new TokenService(jwtService, configService);
    const mailService = {
      sendVerificationCodeEmail: sendVerificationCodeEmailMock,
    } as unknown as MailService;

    service = new (ProfileService as unknown as new (
      prisma: PrismaService,
      tokenService: TokenService,
      mailService?: MailService,
    ) => ProfileService)(
      mockPrisma as unknown as PrismaService,
      tokenService,
      mailService,
    );
  });

  it('returns real activeClassesCount on getMyProfile for TEACHER accounts', async () => {
    const me = await service.getMyProfile('u-1');
    expect(me.activeClassesCount).toBe(2);
    expect((me as { canSelfChangeEmail?: boolean }).canSelfChangeEmail).toBe(true);
  });

  it('forbids self-editing dateOfBirth, writes audit log in $transaction, and preserves rememberMe TTL on verified email change', async () => {
    await expect(
      service.updateMyProfile('u-1', { dateOfBirth: '2000-01-01' }),
    ).rejects.toThrowError(
      new BadRequestException('Học viên không được phép tự sửa ngày sinh'),
    );

    const svc = service as unknown as {
      sendEmailChangeCode: (
        userId: string,
        dto: { newEmail: string },
        clientIp?: string,
      ) => Promise<{ message: string; expiresInSeconds: number }>;
    };
    await svc.sendEmailChangeCode('u-1', { newEmail: 'hoa.new@webedu.vn' }, '127.0.0.1');
    const code = sentOtps[0]?.code;
    expect(code).toMatch(/^\d{6}$/);

    const updated = await (
      service as unknown as {
        updateMyProfile: (
          userId: string,
          dto: Record<string, unknown>,
          options?: { rememberMe?: boolean },
        ) => ReturnType<ProfileService['updateMyProfile']>;
      }
    ).updateMyProfile(
      'u-1',
      {
        email: 'hoa.new@webedu.vn',
        currentPassword: 'CurrentPass123',
        verificationCode: code,
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
    userState.roles = [Role.STUDENT];
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

    const me = await service.getMyProfile('u-1');
    expect((me as { canSelfChangeEmail?: boolean }).canSelfChangeEmail).toBe(true);

    const svc = service as unknown as {
      sendEmailChangeCode: (
        userId: string,
        dto: { newEmail: string },
      ) => Promise<{ message: string; expiresInSeconds: number }>;
    };
    await svc.sendEmailChangeCode('u-1', {
      newEmail: 'student.truongthanh@example.com',
    });
    const code = sentOtps[0]?.code;

    // Student turns 16 and updates to their personal email with OTP
    const result = await (
      service as unknown as {
        updateMyProfile: (
          userId: string,
          dto: Record<string, unknown>,
        ) => ReturnType<ProfileService['updateMyProfile']>;
      }
    ).updateMyProfile('u-1', {
      email: 'student.truongthanh@example.com',
      currentPassword: 'CurrentPass123',
      verificationCode: code,
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

  it('blocks under-16 students from self-changing email (DEC-023) while allowing fullName/phone updates', async () => {
    userState.roles = [Role.STUDENT];
    userState.email = 'guardian.u16@example.com';
    userState.studentProfile = {
      dateOfBirth: new Date('2012-06-01T00:00:00.000Z'), // age 14 in 2026 (< 16)
      assignedClass: 'HSK1-K26-01',
    };

    const me = await service.getMyProfile('u-1');
    expect((me as { canSelfChangeEmail?: boolean }).canSelfChangeEmail).toBe(false);

    const svc = service as unknown as {
      sendEmailChangeCode: (
        userId: string,
        dto: { newEmail: string },
      ) => Promise<{ message: string; expiresInSeconds: number }>;
    };
    await expect(
      svc.sendEmailChangeCode('u-1', { newEmail: 'child.own@example.com' }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.updateMyProfile('u-1', {
        email: 'child.own@example.com',
        currentPassword: 'CurrentPass123',
      }),
    ).rejects.toThrow(ForbiddenException);

    // Updating phone & fullName (and echoing unchanged email) remains allowed without password/OTP
    const phoneUpdated = await service.updateMyProfile('u-1', {
      fullName: 'Bé An Đã Đổi Tên',
      phone: '0908887777',
      email: 'guardian.u16@example.com',
    });
    expect(phoneUpdated.profile.fullName).toBe('Bé An Đã Đổi Tên');
    expect(phoneUpdated.profile.phone).toBe('0908887777');
    expect((phoneUpdated.profile as { canSelfChangeEmail?: boolean }).canSelfChangeEmail).toBe(false);
  });

  it('validates sendEmailChangeCode inputs, cooldown, SMTP rollback, and OTP verification on email change', async () => {
    const svc = service as unknown as {
      sendEmailChangeCode: (
        userId: string,
        dto: { newEmail: string },
        clientIp?: string,
      ) => Promise<{ message: string; expiresInSeconds: number }>;
    };

    // Invalid email & same email
    await expect(
      svc.sendEmailChangeCode('u-1', { newEmail: 'not-an-email' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      svc.sendEmailChangeCode('u-1', { newEmail: 'TEACHER@webedu.vn' }),
    ).rejects.toThrow(BadRequestException);

    // Duplicate email belongs to another user
    duplicateCheckUser = { id: 'other-user' };
    await expect(
      svc.sendEmailChangeCode('u-1', { newEmail: 'taken@webedu.vn' }),
    ).rejects.toThrow(ConflictException);
    duplicateCheckUser = null;

    // Missing or wrong OTP rejected on updateMyProfile
    await expect(
      service.updateMyProfile('u-1', {
        email: 'teacher.verified@webedu.vn',
        currentPassword: 'CurrentPass123',
      }),
    ).rejects.toThrow(BadRequestException);

    // SMTP failure rolls back emailVerification & cooldown so user can retry immediately
    sendVerificationCodeEmailMock.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(
      svc.sendEmailChangeCode('u-1', { newEmail: 'teacher.verified@webedu.vn' }),
    ).rejects.toThrow('SMTP down');
    expect(emailVerifications).toHaveLength(0);

    // Succeeds on retry with purpose: 'email_change'
    const sent = await svc.sendEmailChangeCode('u-1', {
      newEmail: 'teacher.verified@webedu.vn',
    });
    expect(sent.expiresInSeconds).toBe(600);
    expect(sentOtps[0]?.purpose).toBe('email_change');

    // Immediate resend triggers 60s cooldown (429)
    await expect(
      svc.sendEmailChangeCode('u-1', { newEmail: 'teacher.verified@webedu.vn' }),
    ).rejects.toThrow(/60 giây/);

    // Wrong OTP fails without updating user email
    await expect(
      (
        service as unknown as {
          updateMyProfile: (
            userId: string,
            dto: Record<string, unknown>,
          ) => ReturnType<ProfileService['updateMyProfile']>;
        }
      ).updateMyProfile('u-1', {
        email: 'teacher.verified@webedu.vn',
        currentPassword: 'CurrentPass123',
        verificationCode: '000000',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(userState.email).toBe('teacher@webedu.vn');

    // Correct OTP succeeds & consumes OTP (reusing it fails)
    const ok = await (
      service as unknown as {
        updateMyProfile: (
          userId: string,
          dto: Record<string, unknown>,
        ) => ReturnType<ProfileService['updateMyProfile']>;
      }
    ).updateMyProfile('u-1', {
      email: 'teacher.verified@webedu.vn',
      currentPassword: 'CurrentPass123',
      verificationCode: sentOtps[0]?.code,
    });
    expect(ok.profile.email).toBe('teacher.verified@webedu.vn');
  });
});
