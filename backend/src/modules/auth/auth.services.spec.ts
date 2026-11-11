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
import { AuthLoginService } from './services/auth-login.service.js';
import { AuthRegistrationService } from './services/auth-registration.service.js';
import { AuthSessionService } from './services/auth-session.service.js';
import { PasswordRecoveryService } from './services/password-recovery.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { MailService, type PasswordResetEmailInput } from '../../common/mail/mail.service.js';
import { CONSENT_TEXT_V1_0, CONSENT_VERSION } from '../../common/auth/auth.types.js';

interface AuthTestFacade {
  register: AuthRegistrationService['register'];
  sendVerificationCode: AuthRegistrationService['sendVerificationCode'];
  login: AuthLoginService['login'];
  getMe: AuthSessionService['getMe'];
  logout: AuthSessionService['logout'];
  forgotPassword: PasswordRecoveryService['forgotPassword'];
  resetPassword: PasswordRecoveryService['resetPassword'];
}

describe('Auth Services (FUNC-001..005 — Hardened Lockout & Mail Abstraction)', () => {
  let service: AuthTestFacade;
  let jwtService: JwtService;
  let signAsyncMock: ReturnType<typeof vi.fn>;
  let configService: ConfigService;
  let mailService: MailService;
  let sentResetEmails: PasswordResetEmailInput[];
  let sentVerificationEmails: Array<{ toEmail: string; code: string; expiresInMinutes: number }>;
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
  let emailVerificationsStore: Map<
    string,
    {
      id: string;
      email: string;
      codeHash: string;
      expiresAt: Date;
      attempts: number;
      verifiedAt: Date | null;
      createdAt: Date;
    }
  >;
  let authRateLimitStore: Map<
    string,
    { points: number; lastAttemptAt: Date; blockedUntil: Date | null }
  >;
  let mockPrisma: Record<string, unknown>;

  beforeEach(() => {
    usersStore = new Map();
    consentsStore = [];
    resetTokensStore = new Map();
    emailRateLimitStore = new Map();
    emailVerificationsStore = new Map();
    sentVerificationEmails = [];
    authRateLimitStore = new Map();
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
    const emailVerificationDelegate = {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const id = `ev-${emailVerificationsStore.size + 1}`;
        const rec = {
          id,
          email: data.email as string,
          codeHash: data.codeHash as string,
          expiresAt: data.expiresAt as Date,
          attempts: (data.attempts as number) ?? 0,
          verifiedAt: (data.verifiedAt as Date | null) ?? null,
          createdAt: new Date(),
        };
        emailVerificationsStore.set(id, rec);
        return rec;
      }),
      findFirst: vi.fn(
        async ({
          where,
          orderBy,
        }: {
          where: Record<string, unknown>;
          orderBy?: Record<string, string>;
        }) => {
          const items = Array.from(emailVerificationsStore.values());
          if (orderBy?.createdAt === 'desc') {
            items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return (
            items.find((v) => {
              if (where.email && v.email !== where.email) return false;
              if (where.verifiedAt === null && v.verifiedAt !== null) return false;
              if (
                where.expiresAt &&
                typeof where.expiresAt === 'object' &&
                'gt' in where.expiresAt &&
                v.expiresAt <= (where.expiresAt as { gt: Date }).gt
              ) {
                return false;
              }
              return true;
            }) ?? null
          );
        },
      ),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const rec = emailVerificationsStore.get(where.id);
          if (!rec) return null;
          if (
            data.attempts &&
            typeof data.attempts === 'object' &&
            'increment' in data.attempts
          ) {
            rec.attempts += Number(
              (data.attempts as { increment: number }).increment,
            );
          }
          if (data.verifiedAt !== undefined) {
            rec.verifiedAt = data.verifiedAt as Date | null;
          }
          return rec;
        },
      ),
    };

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
        if (sql.includes('auth_rate_limits')) {
          if (sql.includes('SELECT "blocked_until" FROM "auth_rate_limits"')) {
            const key = String(values[0]);
            const now = values[1] as Date;
            const rec = authRateLimitStore.get(key);
            if (rec?.blockedUntil && rec.blockedUntil.getTime() > now.getTime()) {
              return [{ blocked_until: rec.blockedUntil }];
            }
            return [];
          }
          if (sql.includes('INSERT INTO "auth_rate_limits"')) {
            const key = String(values[0]);
            const now = values[1] as Date;
            const maxPoints = Number(values.find((v) => typeof v === 'number') ?? 15);
            const blockUntil =
              (values.find(
                (v) => v instanceof Date && v.getTime() > now.getTime(),
              ) as Date) ?? new Date(now.getTime() + 15 * 60 * 1000);
            const windowStart =
              (values.find(
                (v) => v instanceof Date && v.getTime() < now.getTime(),
              ) as Date) ?? new Date(now.getTime() - 60 * 1000);
            let rec = authRateLimitStore.get(key);
            if (!rec) {
              rec = { points: 1, lastAttemptAt: now, blockedUntil: null };
              authRateLimitStore.set(key, rec);
            } else {
              if (rec.blockedUntil && rec.blockedUntil.getTime() > now.getTime()) {
                // keep blocked
              } else if (
                rec.blockedUntil &&
                rec.blockedUntil.getTime() <= now.getTime()
              ) {
                rec.points = 1;
                rec.blockedUntil = null;
              } else if (rec.lastAttemptAt.getTime() < windowStart.getTime()) {
                rec.points = 1;
                rec.blockedUntil = null;
              } else {
                rec.points += 1;
                if (rec.points > maxPoints) {
                  rec.blockedUntil = blockUntil;
                }
              }
              rec.lastAttemptAt = now;
            }
            return [
              {
                key,
                points: rec.points,
                last_attempt_at: rec.lastAttemptAt,
                blocked_until: rec.blockedUntil,
              },
            ];
          }
        }
        return [];
      }),
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('DELETE FROM "auth_rate_limits"')) {
          const key = String(values[0]);
          authRateLimitStore.delete(key);
        }
        return 1;
      }),
      user: userDelegate,
      studentProfile: studentProfileDelegate,
      guardianConsent: guardianConsentDelegate,
      passwordResetToken: passwordResetTokenDelegate,
      emailRateLimit: emailRateLimitDelegate,
      emailVerification: emailVerificationDelegate,
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
      sendVerificationCodeEmail: vi.fn(
        async (input: { toEmail: string; code: string; expiresInMinutes: number }) => {
          sentVerificationEmails.push(input);
        },
      ),
    } as unknown as MailService;

    const prisma = mockPrisma as unknown as PrismaService;
    const sessionService = new AuthSessionService(prisma, jwtService, configService);
    const registrationService = new AuthRegistrationService(
      prisma,
      sessionService,
      mailService,
    );
    const loginService = new AuthLoginService(prisma, sessionService);
    const recoveryService = new PasswordRecoveryService(prisma, mailService);

    service = {
      register: registrationService.register.bind(registrationService),
      sendVerificationCode:
        registrationService.sendVerificationCode.bind(registrationService),
      login: loginService.login.bind(loginService),
      getMe: sessionService.getMe.bind(sessionService),
      logout: sessionService.logout.bind(sessionService),
      forgotPassword: recoveryService.forgotPassword.bind(recoveryService),
      resetPassword: recoveryService.resetPassword.bind(recoveryService),
    };
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

    it('requires guardianConsent=true when student is 12-15 years old', async () => {
      await expect(
        service.register({
          fullName: 'Thiếu Niên',
          dateOfBirth: '2012-05-10',
          phone: '0901112223',
          email: 'parent.thieunien@example.com',
          password: 'Password123',
          guardianConsent: false,
        }),
      ).rejects.toThrowError(
        new BadRequestException('Vui lòng xác nhận đã có sự đồng ý của cha mẹ'),
      );
    });

    it('registers student aged 12-15 using parent email and records immutable GuardianConsent snapshot', async () => {
      const reg = await service.register(
        {
          fullName: 'Nguyễn Văn An',
          dateOfBirth: '2012-03-15',
          phone: '0902223331',
          email: 'Parent.An@Example.com ',
          password: 'Password123',
          guardianConsent: true,
        },
        { ipAddress: '127.0.0.1', userAgent: 'Vitest-Agent' },
      );

      expect(reg.user.status).toBe(UserStatus.PENDING_CLASS);
      expect(reg.user.email).toBe('parent.an@example.com');
      expect(consentsStore).toHaveLength(1);
      expect(consentsStore[0]).toEqual(
        expect.objectContaining({
          guardianEmail: 'parent.an@example.com',
          consented: true,
          consentVersion: CONSENT_VERSION,
          consentTextSnapshot: CONSENT_TEXT_V1_0,
          ipAddress: '127.0.0.1',
          userAgent: 'Vitest-Agent',
        }),
      );
    });

    it('rejects duplicate email or phone with clear, specific 409 Conflict messages', async () => {
      await service.register({
        fullName: 'Học Viên 1',
        dateOfBirth: '2000-01-01',
        phone: '0903334444',
        email: 'dup@example.com',
        password: 'Password123',
      });

      // Duplicate email only
      await expect(
        service.register({
          fullName: 'Học Viên 2',
          dateOfBirth: '2000-01-01',
          phone: '0909998888',
          email: 'DUP@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrowError(
        new ConflictException(
          'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác',
        ),
      );

      // Duplicate phone only
      await expect(
        service.register({
          fullName: 'Học Viên 3',
          dateOfBirth: '2000-01-01',
          phone: '0903334444',
          email: 'unique3@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrowError(new ConflictException('Số điện thoại này đã được đăng ký'));

      // Duplicate both email and phone
      await expect(
        service.register({
          fullName: 'Học Viên 4',
          dateOfBirth: '2000-01-01',
          phone: '0903334444',
          email: 'dup@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrowError(
        new ConflictException('Email và số điện thoại này đã được sử dụng'),
      );
    });

    it('sends 6-digit verification code, enforces rate limit cooldown, and validates OTP on register', async () => {
      // 1. Send verification code
      const sendResult = await service.sendVerificationCode('test.otp@example.com');
      expect(sendResult.expiresInSeconds).toBe(600);
      expect(sentVerificationEmails).toHaveLength(1);
      const sentEmail = sentVerificationEmails[0]!;
      expect(sentEmail.toEmail).toBe('test.otp@example.com');
      expect(sentEmail.code).toHaveLength(6);

      // 2. Rate limit cooldown within 60s
      await expect(
        service.sendVerificationCode('test.otp@example.com'),
      ).rejects.toThrowError(HttpException);

      // 3. Register with wrong code
      await expect(
        service.register({
          fullName: 'Học Viên OTP',
          dateOfBirth: '2000-01-01',
          phone: '0908889999',
          email: 'test.otp@example.com',
          password: 'Password123',
          verificationCode: '000000',
        }),
      ).rejects.toThrowError(new BadRequestException('Mã xác thực không chính xác'));

      // 4. Register with correct code
      const regSuccess = await service.register({
        fullName: 'Học Viên OTP',
        dateOfBirth: '2000-01-01',
        phone: '0908889999',
        email: 'test.otp@example.com',
        password: 'Password123',
        verificationCode: sentEmail.code,
      });
      expect(regSuccess.user.status).toBe(UserStatus.PENDING_CLASS);
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

    it('enforces IP rate limiting on repeated failed logins (FIX-03)', async () => {
      const clientIp = '198.51.100.42';

      // Simulate 15 consecutive wrong passwords from the same IP
      for (let i = 0; i < 15; i++) {
        await expect(
          service.login(
            { email: 'nonexistent@example.com', password: 'WrongPassword' },
            clientIp,
          ),
        ).rejects.toThrowError(UnauthorizedException);
      }

      // The 16th request from this IP must be blocked with 429 Too Many Requests
      await expect(
        service.login(
          { email: 'nonexistent@example.com', password: 'WrongPassword' },
          clientIp,
        ),
      ).rejects.toThrowError(
        new HttpException(
          'Quá nhiều lần đăng nhập không thành công từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
          429,
        ),
      );
    });

    it('enforces IP rate limiting on repeated forgot password requests (FIX-04)', async () => {
      const clientIp = '198.51.100.99';

      // 5 requests with different emails from same IP
      for (let i = 1; i <= 5; i++) {
        const res = await service.forgotPassword(
          { email: `victim${i}@example.com` },
          clientIp,
        );
        expect(res.cooldownSeconds).toBe(60);
      }

      // 6th request from this IP must be throttled with 429 Too Many Requests
      await expect(
        service.forgotPassword({ email: 'victim6@example.com' }, clientIp),
      ).rejects.toThrowError(
        new HttpException(
          'Quá nhiều yêu cầu khôi phục mật khẩu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
          429,
        ),
      );
    });

    it('validates resetPassword token, password length, and confirmPassword mismatch', async () => {
      await expect(
        service.resetPassword({ token: '', newPassword: 'ValidPassword123' }),
      ).rejects.toThrowError(new BadRequestException('Link đã hết hạn, vui lòng gửi lại'));

      await expect(
        service.resetPassword({ token: 'abc', newPassword: 'short' }),
      ).rejects.toThrowError(new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự'));

      await expect(
        service.resetPassword({ token: 'abc', newPassword: 'A'.repeat(73) }),
      ).rejects.toThrowError(
        new BadRequestException('Mật khẩu không được vượt quá 72 ký tự'),
      );

      await expect(
        service.resetPassword({
          token: 'abc',
          newPassword: 'ValidPassword123',
          confirmPassword: 'DifferentPassword123',
        }),
      ).rejects.toThrowError(new BadRequestException('Xác nhận mật khẩu không khớp'));
    });
  });

  describe('FUNC-004: AuthSessionService getMe, logout & Registration Contact Validation', () => {
    it('returns AuthUserDto on getMe, throws NotFoundException on unknown id, and increments tokenVersion on logout', async () => {
      const reg = await service.register({
        fullName: 'Học Viên Phiên',
        dateOfBirth: '2002-04-15',
        phone: '0904445555',
        email: 'session@example.com',
        password: 'Password123',
      });

      const me = await service.getMe(reg.user.id);
      expect(me.email).toBe('session@example.com');
      expect(me.effectiveRole).toBe(Role.STUDENT);

      await expect(service.getMe('nonexistent-id')).rejects.toThrowError(
        'Tài khoản không tồn tại',
      );

      const logoutRes = await service.logout(reg.user.id);
      expect(logoutRes.message).toBe('Đăng xuất thành công');
      expect(usersStore.get(reg.user.id)?.tokenVersion).toBe(1);
    });

    it('validates fullName, email, phone, password length, confirmPassword, and guardianEmail during registration', async () => {
      await expect(
        service.register({
          fullName: '   ',
          dateOfBirth: '2000-01-01',
          phone: '0901112222',
          email: 'valid@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrowError(new BadRequestException('Họ và tên không được để trống'));

      await expect(
        service.register({
          fullName: 'Học Viên',
          dateOfBirth: '2000-01-01',
          phone: '0901112222',
          email: 'not-an-email',
          password: 'Password123',
        }),
      ).rejects.toThrowError(new BadRequestException('Email không hợp lệ'));

      await expect(
        service.register({
          fullName: 'Học Viên',
          dateOfBirth: '2000-01-01',
          phone: '12345',
          email: 'valid@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrowError(
        new BadRequestException('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0'),
      );

      await expect(
        service.register({
          fullName: 'Học Viên',
          dateOfBirth: '2000-01-01',
          phone: '0901112222',
          email: 'valid@example.com',
          password: 'short',
        }),
      ).rejects.toThrowError(new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự'));

      await expect(
        service.register({
          fullName: 'Học Viên',
          dateOfBirth: '2000-01-01',
          phone: '0901112222',
          email: 'valid@example.com',
          password: 'P'.repeat(73),
        }),
      ).rejects.toThrowError(
        new BadRequestException('Mật khẩu không được vượt quá 72 ký tự'),
      );

      await expect(
        service.register({
          fullName: 'Học Viên',
          dateOfBirth: '2000-01-01',
          phone: '0901112222',
          email: 'valid@example.com',
          password: 'Password123',
          confirmPassword: 'MismatchPassword123',
        }),
      ).rejects.toThrowError(new BadRequestException('Xác nhận mật khẩu không khớp'));

      await expect(
        service.register({
          fullName: 'Thiếu Niên',
          dateOfBirth: '2012-05-10',
          phone: '0901112222',
          email: 'teen@example.com',
          password: 'Password123',
          guardianConsent: false,
        }),
      ).rejects.toThrowError(
        new BadRequestException('Vui lòng xác nhận đã có sự đồng ý của cha mẹ'),
      );
    });

    it('enforces exact 15m lockout expiry, 60s forgot-password cooldown, and 15m reset token TTL under fake clock (Bước 3.D)', async () => {
      await service.register({
        fullName: 'Học Viên Đồng Hồ',
        dateOfBirth: '2000-01-01',
        phone: '0906667777',
        email: 'clock@example.com',
        password: 'CorrectPassword123',
      });

      vi.useFakeTimers();
      try {
        const baseNow = new Date('2026-11-07T23:59:59+07:00');
        vi.setSystemTime(baseNow);

        // 1. Trigger 5 wrong logins -> locked for 15 minutes
        for (let i = 0; i < 5; i++) {
          await expect(
            service.login({ email: 'clock@example.com', password: 'WrongPassword!' }),
          ).rejects.toThrow();
        }

        // At +14m 59s -> still locked
        vi.setSystemTime(new Date(baseNow.getTime() + (14 * 60 + 59) * 1000));
        await expect(
          service.login({ email: 'clock@example.com', password: 'CorrectPassword123' }),
        ).rejects.toThrowError('Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần');

        // At +15m 01s -> lockout expired, login succeeds!
        vi.setSystemTime(new Date(baseNow.getTime() + (15 * 60 + 1) * 1000));
        const unlockedLogin = await service.login({
          email: 'clock@example.com',
          password: 'CorrectPassword123',
        });
        expect(unlockedLogin.user.email).toBe('clock@example.com');

        // 2. Forgot password 60s cooldown & 15m token TTL
        const t0 = new Date('2026-11-08T10:00:00+07:00');
        vi.setSystemTime(t0);
        await service.forgotPassword({ email: 'clock@example.com' });
        const firstToken = sentResetEmails[sentResetEmails.length - 1]!.rawToken;

        // At +59s -> still in cooldown
        vi.setSystemTime(new Date(t0.getTime() + 59 * 1000));
        await expect(
          service.forgotPassword({ email: 'clock@example.com' }),
        ).rejects.toThrowError('Vui lòng đợi trước khi gửi lại yêu cầu');

        // At +61s -> cooldown expired, can request again
        vi.setSystemTime(new Date(t0.getTime() + 61 * 1000));
        await service.forgotPassword({ email: 'clock@example.com' });
        const secondToken = sentResetEmails[sentResetEmails.length - 1]!.rawToken;

        // Advance to t0 + 15m 01s -> firstToken (issued at t0) has expired (> 15m TTL)!
        vi.setSystemTime(new Date(t0.getTime() + (15 * 60 + 1) * 1000));
        await expect(
          service.resetPassword({ token: firstToken, newPassword: 'NewPassword456' }),
        ).rejects.toThrowError('Link đã hết hạn, vui lòng gửi lại');

        // Advance to t0 + 61s + 15m 01s -> secondToken (issued at t0 + 61s) has also expired!
        vi.setSystemTime(new Date(t0.getTime() + (61 + 15 * 60 + 1) * 1000));
        await expect(
          service.resetPassword({ token: secondToken, newPassword: 'NewPassword456' }),
        ).rejects.toThrowError('Link đã hết hạn, vui lòng gửi lại');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
