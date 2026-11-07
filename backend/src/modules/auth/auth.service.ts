import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { MailService } from '../../common/mail/mail.service.js';
import { calculateAgeInVnTimezone } from '../../common/utils/timezone.util.js';
import { rethrowDuplicateContactConflict } from '../../common/utils/prisma-error.util.js';
import {
  CONSENT_TEXT_V1_0,
  CONSENT_VERSION,
  type AuthUserDto,
  type JwtPayload,
} from '../../common/auth/auth.types.js';
import {
  getDefaultRedirectByRole,
  getHighestRole,
} from '../../common/auth/role-hierarchy.util.js';
import { IDLE_TIMEOUT_MS } from '../../common/guards/jwt-auth.guard.js';
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('webedu_dummy_anti_timing_secret_2026', 10);
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes (FUNC-003)
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const FORGOT_PASSWORD_COOLDOWN_MS = 60 * 1000; // 60 seconds (FUNC-005)
const RATE_LIMIT_RETENTION_MS = 10 * 60 * 1000; // 10 minutes cleanup window
const RESET_TOKEN_TTL_MINUTES = 15;
const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60 * 1000; // 15 minutes (FUNC-005)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface RequestClientMeta {
  ipAddress?: string;
  userAgent?: string;
}

export function formatIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(
    dto: RegisterDto,
    meta?: RequestClientMeta,
  ): Promise<{ message: string; user: AuthUserDto }> {
    const fullName = (dto.fullName ?? '').trim();
    if (!fullName) {
      throw new BadRequestException('Họ và tên không được để trống');
    }

    const email = (dto.email ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const phone = (dto.phone ?? '').trim();
    if (!PHONE_REGEX.test(phone)) {
      throw new BadRequestException('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0');
    }

    const password = dto.password ?? '';
    if (password.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (password.length > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 ký tự');
    }

    if (dto.confirmPassword !== undefined && dto.confirmPassword !== password) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const dobStr = (dto.dateOfBirth ?? '').trim();
    if (!ISO_DATE_REGEX.test(dobStr)) {
      throw new BadRequestException('Ngày sinh không hợp lệ (YYYY-MM-DD)');
    }
    const dobDate = new Date(`${dobStr}T00:00:00.000Z`);
    if (Number.isNaN(dobDate.getTime()) || formatIsoDateUtc(dobDate) !== dobStr) {
      throw new BadRequestException('Ngày sinh không hợp lệ');
    }

    const age = calculateAgeInVnTimezone(dobStr, new Date());
    if (age < 12) {
      throw new BadRequestException('Học viên phải từ 12 tuổi trở lên');
    }

    let normalizedGuardianEmail: string | null = null;
    if (age >= 12 && age < 16) {
      const candidateGuardian = (dto.guardianEmail ?? '').trim().toLowerCase();
      if (!EMAIL_REGEX.test(candidateGuardian) || dto.guardianConsent !== true) {
        throw new BadRequestException('Vui lòng xác nhận đã có sự đồng ý của cha mẹ');
      }
      normalizedGuardianEmail = candidateGuardian;
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });
    if (existing) {
      throw new ConflictException('Email/Số điện thoại đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const createdUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            phone,
            fullName,
            passwordHash,
            roles: [Role.STUDENT],
            status: UserStatus.PENDING_CLASS,
          },
        });

        const studentProfile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            dateOfBirth: dobDate,
            guardianEmail: age < 16 ? normalizedGuardianEmail : null,
          },
        });

        if (age >= 12 && age < 16 && normalizedGuardianEmail) {
          await tx.guardianConsent.create({
            data: {
              studentProfileId: studentProfile.id,
              guardianEmail: normalizedGuardianEmail,
              consented: true,
              consentVersion: CONSENT_VERSION,
              consentTextSnapshot: CONSENT_TEXT_V1_0,
              ipAddress: meta?.ipAddress ? meta.ipAddress.slice(0, 64) : null,
              userAgent: meta?.userAgent ? meta.userAgent.slice(0, 500) : null,
            },
          });
        }

        return user;
      });

      const effectiveRole = getHighestRole(createdUser.roles);
      return {
        message: 'Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp',
        user: {
          id: createdUser.id,
          email: createdUser.email,
          fullName: createdUser.fullName,
          phone: createdUser.phone,
          roles: createdUser.roles,
          effectiveRole,
          status: createdUser.status,
          dateOfBirth: dobStr,
        },
      };
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    expiresIn: number;
    redirectTo: string;
    user: AuthUserDto;
  }> {
    const normalizedEmail = (dto.email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestException('Vui lòng đăng nhập bằng địa chỉ email hợp lệ');
    }
    const password = dto.password ?? '';

    const initialUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { studentProfile: true },
    });

    if (!initialUser) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // CPU-bound bcrypt runs outside DB transaction so slow hashing never holds row locks,
    // and BEFORE INACTIVE status check so wrong passwords on INACTIVE accounts return uniform 401.
    const isPasswordValid = await bcrypt.compare(password, initialUser.passwordHash);

    // P0-B1 Fix: Return a discriminated outcome from $transaction so PostgreSQL COMMITS
    // failedLoginAttempts / lockedUntil updates BEFORE any HTTP exception is thrown.
    const txOutcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${initialUser.id} FOR UPDATE`;

      const freshUser = await tx.user.findUnique({
        where: { id: initialUser.id },
        include: { studentProfile: true },
      });

      if (!freshUser) {
        return { kind: 'INVALID_CREDENTIALS' as const };
      }

      const txNow = new Date();

      if (freshUser.lockedUntil && freshUser.lockedUntil.getTime() > txNow.getTime()) {
        return { kind: 'LOCKED_15M' as const };
      }

      const effectivePasswordValid =
        freshUser.passwordHash === initialUser.passwordHash
          ? isPasswordValid
          : await bcrypt.compare(password, freshUser.passwordHash);

      if (!effectivePasswordValid) {
        const isExpiredLock =
          freshUser.lockedUntil !== null &&
          freshUser.lockedUntil.getTime() <= txNow.getTime();
        const newAttempts = isExpiredLock ? 1 : freshUser.failedLoginAttempts + 1;
        const shouldLock = newAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
        const lockedUntil = shouldLock
          ? new Date(txNow.getTime() + LOCKOUT_DURATION_MS)
          : null;

        await tx.user.update({
          where: { id: freshUser.id },
          data: {
            failedLoginAttempts: newAttempts,
            lockedUntil,
          },
        });

        return shouldLock
          ? { kind: 'LOCKED_15M' as const }
          : { kind: 'INVALID_CREDENTIALS' as const };
      }

      if (freshUser.status === UserStatus.INACTIVE) {
        if (freshUser.failedLoginAttempts > 0 || freshUser.lockedUntil !== null) {
          await tx.user.update({
            where: { id: freshUser.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });
        }
        return { kind: 'INACTIVE' as const };
      }

      const wasIdleExpired =
        freshUser.lastActivityAt !== null &&
        txNow.getTime() - freshUser.lastActivityAt.getTime() > IDLE_TIMEOUT_MS;

      const updatedUser = await tx.user.update({
        where: { id: freshUser.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: txNow,
          lastActivityAt: txNow,
          ...(wasIdleExpired ? { tokenVersion: { increment: 1 } } : {}),
        },
        include: { studentProfile: true },
      });

      return { kind: 'SUCCESS' as const, updatedUser };
    });

    if (txOutcome.kind === 'LOCKED_15M') {
      throw new ForbiddenException(
        'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
      );
    }

    if (txOutcome.kind === 'INVALID_CREDENTIALS') {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (txOutcome.kind === 'INACTIVE') {
      throw new ForbiddenException('Tài khoản đã bị khóa, vui lòng liên hệ trung tâm');
    }

    const { updatedUser } = txOutcome;
    const rememberMe = dto.rememberMe === true;
    const expiresInSeconds = rememberMe ? 7 * 24 * 60 * 60 : 3600;

    const payload: JwtPayload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      tokenVersion: updatedUser.tokenVersion,
      ...(rememberMe ? { rememberMe: true } : {}),
    };
    const secret = this.configService.get<string>('JWT_SECRET');
    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: rememberMe ? '7d' : 3600,
    });

    const effectiveRole = getHighestRole(updatedUser.roles);
    const userDto: AuthUserDto = {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      phone: updatedUser.phone,
      roles: updatedUser.roles,
      effectiveRole,
      status: updatedUser.status,
      ...(updatedUser.studentProfile?.dateOfBirth
        ? { dateOfBirth: formatIsoDateUtc(updatedUser.studentProfile.dateOfBirth) }
        : {}),
    };

    return {
      accessToken,
      expiresIn: expiresInSeconds,
      redirectTo: getDefaultRedirectByRole(effectiveRole),
      user: userDto,
    };
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const effectiveRole = getHighestRole(user.roles);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles: user.roles,
      effectiveRole,
      status: user.status,
      ...(user.studentProfile?.dateOfBirth
        ? { dateOfBirth: formatIsoDateUtc(user.studentProfile.dateOfBirth) }
        : {}),
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });
    return { message: 'Đăng xuất thành công' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{
    message: string;
    cooldownSeconds: number;
  }> {
    const normalizedEmail = (dto.email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    const now = new Date();
    const nowMs = now.getTime();
    const cutoff = new Date(nowMs - FORGOT_PASSWORD_COOLDOWN_MS);
    const pruneBefore = new Date(nowMs - RATE_LIMIT_RETENTION_MS);

    // Opportunistically clean stale rate-limit rows (> 10 minutes old)
    await this.prisma.emailRateLimit.deleteMany({
      where: {
        lastRequestedAt: { lt: pruneBefore },
      },
    });

    // Atomic PostgreSQL conditional upsert enforcing 60s cooldown across all instances
    // regardless of whether the target email exists (SEC-06 anti-enumeration).
    const allowedRows = await this.prisma.$queryRaw<Array<{ email_hash: string }>>`
      INSERT INTO "email_rate_limits" ("email_hash", "last_requested_at")
      VALUES (${emailHash}, ${now})
      ON CONFLICT ("email_hash") DO UPDATE
        SET "last_requested_at" = EXCLUDED."last_requested_at"
        WHERE "email_rate_limits"."last_requested_at" <= ${cutoff}
      RETURNING "email_hash"
    `;

    if (allowedRows.length === 0) {
      throw new HttpException(
        'Vui lòng đợi trước khi gửi lại yêu cầu',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(nowMs + RESET_TOKEN_TTL_MS);

      const createdToken = await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      try {
        await this.mailService.sendPasswordResetEmail({
          toEmail: user.email,
          fullName: user.fullName,
          rawToken,
          expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
        });
      } catch (err: unknown) {
        // Revoke orphaned unsent token + release cooldown slot on mail failure,
        // and log sanitized diagnostics without leaking rawToken or user existence.
        await this.prisma.passwordResetToken.deleteMany({
          where: { id: createdToken.id },
        });
        await this.prisma.emailRateLimit.deleteMany({
          where: { emailHash },
        });
        const reason = err instanceof Error ? err.message : 'Unknown mail error';
        this.logger.error(
          `Password reset email delivery failed for hash=${emailHash.slice(0, 12)}: ${reason}`,
        );
      }
    } else {
      // Equalize baseline CPU latency when email does not exist to mitigate timing side-channels
      await bcrypt.compare('webedu_forgot_password_pad', DUMMY_PASSWORD_HASH);
    }

    return {
      message: 'Nếu tài khoản tồn tại, hướng dẫn đã được gửi',
      cooldownSeconds: 60,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const rawToken = (dto.token ?? '').trim();
    if (!rawToken) {
      throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
    }

    const newPassword = dto.newPassword ?? '';
    if (newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (newPassword.length > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 ký tự');
    }

    if (dto.confirmPassword !== undefined && dto.confirmPassword !== newPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
      }

      const tokenRecord = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!tokenRecord) {
        throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
      }

      // Invalidate any other unused reset tokens belonging to this user
      await tx.passwordResetToken.updateMany({
        where: {
          userId: tokenRecord.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }
}
