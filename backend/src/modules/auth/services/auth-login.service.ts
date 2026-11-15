import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type { AuthUserDto } from '../../../common/auth/auth.types.js';
import { assertRateLimitNotBlocked, assertRateLimitNotExceeded } from '../../../common/auth/auth-rate-limit.util.js';
import { comparePassword } from '../../../common/auth/password-hash.util.js';
import { IDLE_TIMEOUT_MS } from '../../../common/guards/jwt-auth.guard.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { EMAIL_REGEX } from '../../../common/utils/contact-validation.util.js';
import type { LoginDto } from '../dto/auth.dto.js';
import { AuthSessionService } from './auth-session.service.js';

export const DUMMY_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8O';
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const IP_WINDOW_MS = 60_000;
const IP_FAILURE_MESSAGE = 'Quá nhiều lần đăng nhập từ địa chỉ IP này. Vui lòng thử lại sau 15 phút';

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
    const normalizedEmail = (dto.email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestException('Vui lòng đăng nhập bằng địa chỉ email hợp lệ');
    }
    const password = dto.password ?? '';
    const failureKey = clientIp && clientIp !== 'unknown' ? `login:failures:ip:${clientIp}` : undefined;
    if (failureKey) {
      await assertRateLimitNotBlocked(this.prisma, failureKey, IP_FAILURE_MESSAGE);
      await assertRateLimitNotExceeded(this.prisma, {
        key: `login:attempts:ip:${clientIp}`,
        // Allow a classroom to sign in together while bounding the pre-bcrypt burst.
        maxPoints: 120,
        windowMs: IP_WINDOW_MS,
        fixedWindow: true,
        blockDurationMs: IP_WINDOW_MS,
      });
    }

    const initialUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { studentProfile: true },
    });

    if (!initialUser) {
      await comparePassword(password, DUMMY_PASSWORD_HASH);
      await this.recordIpFailure(failureKey);
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

      const effectivePasswordValid =
        freshUser.passwordHash === initialUser.passwordHash
          ? isPasswordValid
          : await comparePassword(password, freshUser.passwordHash);

      if (freshUser.lockedUntil && freshUser.lockedUntil.getTime() > txNow.getTime()) {
        return { kind: 'LOCKED_15M' as const, invalidPassword: !effectivePasswordValid };
      }

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
          ? { kind: 'LOCKED_15M' as const, invalidPassword: true }
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
      if (txOutcome.invalidPassword) await this.recordIpFailure(failureKey);
      throw new ForbiddenException(
        'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
      );
    }

    if (txOutcome.kind === 'INVALID_CREDENTIALS') {
      await this.recordIpFailure(failureKey);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    if (txOutcome.kind === 'INACTIVE') {
      throw new ForbiddenException('Tài khoản đã bị khóa, vui lòng liên hệ trung tâm');
    }

    return this.sessionService.issueLoginSession(
      txOutcome.updatedUser,
      dto.rememberMe === true,
    );
  }

  private async recordIpFailure(key: string | undefined): Promise<void> {
    if (!key) return;
    await assertRateLimitNotExceeded(this.prisma, {
      key,
      maxPoints: 15,
      windowMs: IP_WINDOW_MS,
      fixedWindow: true,
      blockDurationMs: LOCKOUT_DURATION_MS,
      errorMessage: IP_FAILURE_MESSAGE,
    });
  }
}
