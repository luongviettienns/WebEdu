import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type { AuthUserDto } from '../../../common/auth/auth.types.js';
import {
  assertIpNotBlocked,
  assertRateLimitNotExceeded,
  resetRateLimitKey,
} from '../../../common/auth/auth-rate-limit.util.js';
import {
  comparePassword,
  hashPasswordSync,
} from '../../../common/auth/password-hash.util.js';
import { IDLE_TIMEOUT_MS } from '../../../common/guards/jwt-auth.guard.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { EMAIL_REGEX } from '../../../common/utils/contact-validation.util.js';
import type { LoginDto } from '../dto/auth.dto.js';
import { AuthSessionService } from './auth-session.service.js';

export const DUMMY_PASSWORD_HASH = hashPasswordSync(
  'webedu_dummy_anti_timing_secret_2026',
);
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

@Injectable()
export class AuthLoginService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: AuthSessionService,
  ) {}

  async login(
    dto: LoginDto,
    clientIp?: string,
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    redirectTo: string;
    user: AuthUserDto;
  }> {
    if (clientIp) {
      await assertIpNotBlocked(
        this.prisma,
        `login:ip:${clientIp}`,
        'Quá nhiều lần đăng nhập không thành công từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
      );
    }

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
      await comparePassword(password, DUMMY_PASSWORD_HASH);
      if (clientIp) {
        await assertRateLimitNotExceeded(this.prisma, {
          key: `login:ip:${clientIp}`,
          maxPoints: 15,
          windowMs: 60 * 1000,
          blockDurationMs: 15 * 60 * 1000,
          errorMessage:
            'Quá nhiều lần đăng nhập không thành công từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
        });
      }
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // CPU-bound bcrypt runs outside DB transaction so slow hashing never holds row locks,
    // and BEFORE INACTIVE status check so wrong passwords on INACTIVE accounts return uniform 401.
    const isPasswordValid = await comparePassword(
      password,
      initialUser.passwordHash,
    );

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
          : await comparePassword(password, freshUser.passwordHash);

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

    if (
      txOutcome.kind === 'LOCKED_15M' ||
      txOutcome.kind === 'INVALID_CREDENTIALS'
    ) {
      if (clientIp) {
        await assertRateLimitNotExceeded(this.prisma, {
          key: `login:ip:${clientIp}`,
          maxPoints: 15,
          windowMs: 60 * 1000,
          blockDurationMs: 15 * 60 * 1000,
          errorMessage:
            'Quá nhiều lần đăng nhập không thành công từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
        });
      }
    }

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

    if (clientIp) {
      await resetRateLimitKey(this.prisma, `login:ip:${clientIp}`).catch(() => {});
    }

    return this.sessionService.issueLoginSession(
      txOutcome.updatedUser,
      dto.rememberMe === true,
    );
  }
}
