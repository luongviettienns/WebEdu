import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { MailService, type PasswordResetEmailInput } from '../../common/mail/mail.service.js';
import { CONSENT_TEXT_V1_0, CONSENT_VERSION } from '../../common/auth/auth.types.js';

describe('AuthService (FUNC-001..005 — Hardened Lockout & Mail Abstraction)', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let signAsyncMock: ReturnType<typeof vi.fn>;
  let configService: ConfigService;
  let mailService: MailService;
  let sentResetEmails: PasswordResetEmailInput[];
  let shouldFailEmailSend: boolean;

  interface MockUserRecord {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    passwordHash: string;
    roles: Role[];
    status: UserStatus;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    tokenVersion: number;
    lastLoginAt: Date | null;
    lastActivityAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    studentProfile?: {
      id: string;
      userId: string;
      dateOfBirth: Date;
      guardianEmail: string | null;
    } | null;
  }

  let usersStore: Map<string, MockUserRecord>;
  let consentsStore: Array<Record<string, unknown>>;
  let resetTokensStore: Map<
    string,
    { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }
  >;
  let emailRateLimitStore: Map<string, Date>;
  let mockPrisma: Record<string, unknown>;

  beforeEach(() => {
    usersStore = new Map();
    consentsStore = [];
    resetTokensStore = new Map();
    emailRateLimitStore = new Map();
    sentResetEmails = [];
    shouldFailEmailSend = false;

    const userDelegate = {
      findFirst: vi.fn(
        async ({ where }: { where: { OR?: Array<{ email?: string; phone?: string }> } }) => {
          for (const u of usersStore.values()) {
            if (where.OR) {
              for (const cond of where.OR) {
                if (cond.email && u.email === cond.email) return u;
                if (cond.phone && u.phone === cond.phone) return u;
              }
            }
          }
          return null;
        },
      ),
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) {
          return usersStore.get(where.id) ?? null;
        }
        if (where.email) {
          for (const u of usersStore.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `user-${usersStore.size + 1}`;
        const now = new Date();
        const record: MockUserRecord = {
          id,
          email: data.email as string,
          phone: data.phone as string,
          fullName: data.fullName as string,
          passwordHash: data.passwordHash as string,
          roles: (data.roles as Role[]) ?? [Role.STUDENT],
          status: (data.status as UserStatus) ?? UserStatus.PENDING_CLASS,
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: 0,
          lastLoginAt: null,
          lastActivityAt: null,
          createdAt: now,
          updatedAt: now,
          studentProfile: null,
        };
        usersStore.set(id, record);
        return record;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const record = usersStore.get(where.id);
          if (!record) throw new Error('User not found');
          if (typeof data.failedLoginAttempts === 'number') {
            record.failedLoginAttempts = data.failedLoginAttempts;
          }
          if ('lockedUntil' in data) {
            record.lockedUntil = (data.lockedUntil as Date | null) ?? null;
          }
          if (data.lastLoginAt instanceof Date) {
            record.lastLoginAt = data.lastLoginAt;
          }
          if (data.lastActivityAt instanceof Date) {
            record.lastActivityAt = data.lastActivityAt;
          }
          if (typeof data.passwordHash === 'string') {
            record.passwordHash = data.passwordHash;
          }
          if (
            data.tokenVersion &&
            typeof data.tokenVersion === 'object' &&
            'increment' in data.tokenVersion
          ) {
            record.tokenVersion += Number(
              (data.tokenVersion as { increment: number }).increment,
            );
          }
          return record;
        },
      ),
    };

    const studentProfileDelegate = {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const profile = {
          id: `sp-${usersStore.size}`,
          userId: data.userId as string,
          dateOfBirth: data.dateOfBirth as Date,
          guardianEmail: (data.guardianEmail as string | null) ?? null,
        };
        const u = usersStore.get(profile.userId);
        if (u) u.studentProfile = profile;
        return profile;
      }),
    };

    const guardianConsentDelegate = {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        consentsStore.push(data);
        return { id: `gc-${consentsStore.length}`, ...data };
      }),
    };

    const passwordResetTokenDelegate = {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const rec = {
          id: `prt-${resetTokensStore.size + 1}`,
          userId: data.userId as string,
          tokenHash: data.tokenHash as string,
          expiresAt: data.expiresAt as Date,
          usedAt: null,
        };
        resetTokensStore.set(rec.tokenHash, rec);
        return rec;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: {
            tokenHash?: string;
            userId?: string;
            usedAt: null;
            expiresAt?: { gt: Date };
          };
          data: { usedAt: Date };
        }) => {
          if (where.tokenHash) {
            const rec = resetTokensStore.get(where.tokenHash);
            if (
              rec &&
              rec.usedAt === null &&
              (!where.expiresAt || rec.expiresAt.getTime() > where.expiresAt.gt.getTime())
            ) {
              rec.usedAt = data.usedAt;
              return { count: 1 };
            }
            return { count: 0 };
          }
          let count = 0;
          if (where.userId) {
            for (const rec of resetTokensStore.values()) {
              if (rec.userId === where.userId && rec.usedAt === null) {
                rec.usedAt = data.usedAt;
                count += 1;
              }
            }
          }
          return { count };
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { id?: string } }) => {
        let count = 0;
        for (const [hash, rec] of resetTokensStore.entries()) {
          if (!where.id || rec.id === where.id) {
            resetTokensStore.delete(hash);
            count += 1;
          }
        }
        return { count };
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        return resetTokensStore.get(where.tokenHash) ?? null;
      }),
    };

    const emailRateLimitDelegate = {
      deleteMany: vi.fn(
        async ({
          where,
        }: {
          where: { emailHash?: string; lastRequestedAt?: { lt: Date } };
        }) => {
          let count = 0;
          if (where.emailHash) {
            if (emailRateLimitStore.delete(where.emailHash)) {
              count += 1;
            }
            return { count };
          }
          if (where.lastRequestedAt?.lt) {
            for (const [hash, ts] of emailRateLimitStore.entries()) {
              if (ts.getTime() < where.lastRequestedAt.lt.getTime()) {
                emailRateLimitStore.delete(hash);
                count += 1;
              }
            }
          }
          return { count };
        },
      ),
    };

    // Serialize $transaction AND faithfully roll back store state if callback throws!
    let txChain = Promise.resolve();
    mockPrisma = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('email_rate_limits')) {
          const emailHash = String(values[0]);
          const now = values[1] as Date;
          const cutoff = values[2] as Date;
          const existing = emailRateLimitStore.get(emailHash);
          if (!existing || existing.getTime() <= cutoff.getTime()) {
            emailRateLimitStore.set(emailHash, now);
            return [{ email_hash: emailHash }];
          }
          return [];
        }
        return [];
      }),
      user: userDelegate,
      studentProfile: studentProfileDelegate,
      guardianConsent: guardianConsentDelegate,
      passwordResetToken: passwordResetTokenDelegate,
      emailRateLimit: emailRateLimitDelegate,
      $transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const prev = txChain;
        let release!: () => void;
        const curr = new Promise<void>((r) => {
          release = r;
        });
        txChain = prev.then(() => curr);
        await prev;

        // Snapshot usersStore to catch accidental throw-inside-transaction rollback bugs!
        const snapshot = new Map<string, MockUserRecord>();
        for (const [id, u] of usersStore.entries()) {
          snapshot.set(id, { ...u });
        }

        try {
          return await cb(mockPrisma);
        } catch (err) {
          usersStore = snapshot;
          throw err;
        } finally {
          release();
        }
      }),
    };

    signAsyncMock = vi.fn().mockResolvedValue('signed-jwt-token');
    jwtService = {
      signAsync: signAsyncMock,
    } as unknown as JwtService;

    configService = {
      get: vi.fn((key: string, defaultVal?: string) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret-key-minimum-32-chars';
        if (key === 'NODE_ENV') return 'test';
        return defaultVal;
      }),
    } as unknown as ConfigService;

    mailService = {
      sendPasswordResetEmail: vi.fn(async (input: PasswordResetEmailInput) => {
        if (shouldFailEmailSend) {
          throw new Error('SMTP connection refused');
        }
        sentResetEmails.push(input);
      }),
    } as unknown as MailService;

    service = new AuthService(
      mockPrisma as unknown as PrismaService,
      jwtService,
      configService,
      mailService,
    );
  });

  describe('FUNC-001 & FUNC-002: Register & Guardian Consent', () => {
    it('rejects registration when student is under 12 years old', async () => {
      await expect(
        service.register({
          fullName: 'Bé Nhỏ',
          dateOfBirth: '2018-06-01',
          phone: '0901112222',
          email: 'benho@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrowError(new BadRequestException('Học viên phải từ 12 tuổi trở lên'));
    });

    it('requires guardianEmail and guardianConsent=true when student is 12-15 years old', async () => {
      await expect(
        service.register({
          fullName: 'Thiếu Niên',
          dateOfBirth: '2012-05-10',
          phone: '0901112223',
          email: 'thieunien@example.com',
          password: 'Password123',
          guardianEmail: 'parent@example.com',
          guardianConsent: false,
        }),
      ).rejects.toThrowError(
        new BadRequestException('Vui lòng xác nhận đã có sự đồng ý của cha mẹ'),
      );
    });

    it('allows two siblings aged 12-15 to share the same guardianEmail and records GuardianConsent snapshot (AUTH-01, AUTH-03)', async () => {
      const sibling1 = await service.register(
        {
          fullName: 'Nguyễn Văn Anh',
          dateOfBirth: '2012-03-15',
          phone: '0902223331',
          email: 'anh.sibling@example.com',
          password: 'Password123',
          guardianEmail: 'Mother@Example.com ',
          guardianConsent: true,
        },
        { ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent' },
      );

      const sibling2 = await service.register(
        {
          fullName: 'Nguyễn Thị Em',
          dateOfBirth: '2013-08-20',
          phone: '0902223332',
          email: 'em.sibling@example.com',
          password: 'Password123',
          guardianEmail: 'mother@example.com',
          guardianConsent: true,
        },
        { ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent' },
      );

      expect(sibling1.user.status).toBe(UserStatus.PENDING_CLASS);
      expect(sibling2.user.status).toBe(UserStatus.PENDING_CLASS);
      expect(consentsStore).toHaveLength(2);
      expect(consentsStore[0]).toEqual(
        expect.objectContaining({
          guardianEmail: 'mother@example.com',
          consented: true,
          consentVersion: CONSENT_VERSION,
          consentTextSnapshot: CONSENT_TEXT_V1_0,
          ipAddress: '127.0.0.1',
          userAgent: 'Vitest-Agent',
        }),
      );
    });

    it('rejects duplicate email or phone with 409 Conflict', async () => {
      await service.register({
        fullName: 'Học Viên 1',
        dateOfBirth: '2000-01-01',
        phone: '0903334444',
        email: 'dup@example.com',
        password: 'Password123',
      });

      await expect(
        service.register({
          fullName: 'Học Viên 2',
          dateOfBirth: '2000-01-01',
          phone: '0909998888',
          email: 'DUP@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrowError(new ConflictException('Email/Số điện thoại đã được sử dụng'));
    });
  });

  describe('FUNC-003: Login, Anti-Timing & Atomic Commit-Before-Throw 5-Strike Lockout', () => {
    it('runs dummy bcrypt comparison when user does not exist (SEC-05)', async () => {
      const compareSpy = vi.spyOn(bcrypt, 'compare');
      await expect(
        service.login({ email: 'nonexistent@example.com', password: 'WrongPassword123' }),
      ).rejects.toThrowError(new UnauthorizedException('Email hoặc mật khẩu không chính xác'));

      expect(compareSpy).toHaveBeenCalledTimes(1);
      compareSpy.mockRestore();
    });

    it('returns uniform 401 on wrong password for INACTIVE account and 403 only on right password', async () => {
      const reg = await service.register({
        fullName: 'Học Viên Khóa',
        dateOfBirth: '2000-05-05',
        phone: '0905557777',
        email: 'inactive.user@example.com',
        password: 'CorrectPassword123',
      });
      const rec = usersStore.get(reg.user.id)!;
      rec.status = UserStatus.INACTIVE;

      await expect(
        service.login({ email: 'inactive.user@example.com', password: 'WrongPassword999' }),
      ).rejects.toThrowError(new UnauthorizedException('Email hoặc mật khẩu không chính xác'));

      await expect(
        service.login({ email: 'inactive.user@example.com', password: 'CorrectPassword123' }),
      ).rejects.toThrowError(
        new ForbiddenException('Tài khoản đã bị khóa, vui lòng liên hệ trung tâm'),
      );
    });

    it('honors rememberMe=true with 7-day JWT expiry and 3600s when omitted', async () => {
      await service.register({
        fullName: 'Học Viên Ghi Nhớ',
        dateOfBirth: '2000-05-05',
        phone: '0905558888',
        email: 'remember@example.com',
        password: 'CorrectPassword123',
      });

      const defaultLogin = await service.login({
        email: 'remember@example.com',
        password: 'CorrectPassword123',
      });
      expect(defaultLogin.expiresIn).toBe(3600);

      const rememberLogin = await service.login({
        email: 'remember@example.com',
        password: 'CorrectPassword123',
        rememberMe: true,
      });
      expect(rememberLogin.expiresIn).toBe(7 * 24 * 60 * 60);
      expect(signAsyncMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ email: 'remember@example.com', rememberMe: true }),
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });

    it('commits failedLoginAttempts & lockedUntil BEFORE throwing on 6 concurrent wrong logins (P0-B1)', async () => {
      const reg = await service.register({
        fullName: 'Học Viên Test Khóa',
        dateOfBirth: '2000-05-05',
        phone: '0905556666',
        email: 'locktest@example.com',
        password: 'CorrectPassword123',
      });

      const outcomes = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          service.login({ email: 'locktest@example.com', password: 'WrongPassword!' }),
        ),
      );

      const statuses = outcomes.map((o) =>
        o.status === 'rejected' && o.reason instanceof HttpException ? o.reason.getStatus() : 200,
      );

      expect(statuses.filter((s) => s === 401)).toHaveLength(4);
      expect(statuses.filter((s) => s === 403)).toHaveLength(2);

      // Verify state actually committed in store (would be 0 if $transaction threw!)
      const persisted = usersStore.get(reg.user.id)!;
      expect(persisted.failedLoginAttempts).toBe(5);
      expect(persisted.lockedUntil).toBeInstanceOf(Date);

      // Correct password rejected while locked
      await expect(
        service.login({ email: 'locktest@example.com', password: 'CorrectPassword123' }),
      ).rejects.toThrowError(
        new ForbiddenException('Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần'),
      );
    });
  });

  describe('FUNC-005: Forgot & Reset Password (DB Cooldown, Mail Abstraction & Zero Token Leak)', () => {
    it('enforces 60s DB cooldown, delivers rawToken only via MailService, never leaks token in response, and consumes token once', async () => {
      const res1 = await service.forgotPassword({ email: 'ghost@example.com' });
      expect(res1.cooldownSeconds).toBe(60);
      expect('debugResetToken' in res1).toBe(false);

      await expect(
        service.forgotPassword({ email: 'ghost@example.com' }),
      ).rejects.toThrowError('Vui lòng đợi trước khi gửi lại yêu cầu');

      await service.register({
        fullName: 'Học Viên Quên MK',
        dateOfBirth: '2001-02-02',
        phone: '0907778888',
        email: 'resetme@example.com',
        password: 'OldPassword123',
      });

      const forgotRes = await service.forgotPassword({ email: 'resetme@example.com' });
      expect('debugResetToken' in forgotRes).toBe(false);
      expect(sentResetEmails).toHaveLength(1);
      const rawToken = sentResetEmails[0]!.rawToken;
      expect(rawToken).toHaveLength(64);

      const resetRes = await service.resetPassword({
        token: rawToken,
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });
      expect(resetRes.message).toBe('Đặt lại mật khẩu thành công');

      // Replaying the same token must fail with 400
      await expect(
        service.resetPassword({
          token: rawToken,
          newPassword: 'AnotherPassword789',
        }),
      ).rejects.toThrowError(new BadRequestException('Link đã hết hạn, vui lòng gửi lại'));
    });

    it('revokes orphaned token and preserves uniform anti-enumeration response when SMTP delivery fails', async () => {
      await service.register({
        fullName: 'Học Viên Lỗi SMTP',
        dateOfBirth: '2001-02-02',
        phone: '0907779999',
        email: 'smtpfail@example.com',
        password: 'OldPassword123',
      });

      shouldFailEmailSend = true;
      const res = await service.forgotPassword({ email: 'smtpfail@example.com' });

      expect(res).toEqual({
        message: 'Nếu tài khoản tồn tại, hướng dẫn đã được gửi',
        cooldownSeconds: 60,
      });
      // Orphaned token was deleted so unsent token never lingers in DB
      expect(resetTokensStore.size).toBe(0);
    });
  });
});
