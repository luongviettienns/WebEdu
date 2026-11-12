import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import crypto from 'node:crypto';
import {
  acquireEmailCooldownOrThrow,
  assertRateLimitNotExceeded,
} from '../../../common/auth/auth-rate-limit.util.js';
import {
  assertPasswordWithinLimit,
  hashPassword,
} from '../../../common/auth/password-hash.util.js';
import { MailService } from '../../../common/mail/mail.service.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { EMAIL_REGEX } from '../../../common/utils/contact-validation.util.js';
import type { ForgotPasswordDto, ResetPasswordDto } from '../dto/auth.dto.js';

const FORGOT_PASSWORD_COOLDOWN_MS = 60 * 1000;
const RESET_TOKEN_TTL_MINUTES = 15;
const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60 * 1000;
const MAX_FORGOT_REQUESTS_PER_IP = 5;
const MAX_RESET_ATTEMPTS_PER_IP = 10;
const IP_WINDOW_MS = 15 * 60 * 1000;
const MIN_FORGOT_PASSWORD_RESPONSE_MS = 250;

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  private async padMinimumDuration(startedAtMs: number): Promise<void> {
    const elapsed = Date.now() - startedAtMs;
    const remaining = MIN_FORGOT_PASSWORD_RESPONSE_MS - elapsed;
    if (remaining > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
    }
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    clientIp?: string,
  ): Promise<{
    message: string;
    cooldownSeconds: number;
  }> {
    const normalizedEmail = (dto.email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    if (clientIp && clientIp !== 'unknown') {
      await assertRateLimitNotExceeded(this.prisma, {
        key: `forgot:ip:${clientIp}`,
        maxPoints: MAX_FORGOT_REQUESTS_PER_IP,
        windowMs: IP_WINDOW_MS,
        blockDurationMs: IP_WINDOW_MS,
        errorMessage:
          'Quá nhiều yêu cầu khôi phục mật khẩu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
      });
    }

    const emailHash = crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');
    const now = new Date();
    const nowMs = now.getTime();

    await acquireEmailCooldownOrThrow(
      this.prisma,
      emailHash,
      FORGOT_PASSWORD_COOLDOWN_MS,
      'Vui lòng đợi trước khi gửi lại yêu cầu',
      now,
    );

    const startedAt = Date.now();
    try {
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
      }
    } finally {
      // Flatten timing side-channel between existing vs non-existing emails
      await this.padMinimumDuration(startedAt);
    }

    return {
      message: 'Nếu tài khoản tồn tại, hướng dẫn đã được gửi',
      cooldownSeconds: 60,
    };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    clientIp?: string,
  ): Promise<{ message: string }> {
    if (clientIp && clientIp !== 'unknown') {
      await assertRateLimitNotExceeded(this.prisma, {
        key: `reset:ip:${clientIp}`,
        maxPoints: MAX_RESET_ATTEMPTS_PER_IP,
        windowMs: IP_WINDOW_MS,
        blockDurationMs: IP_WINDOW_MS,
        errorMessage:
          'Quá nhiều yêu cầu đặt lại mật khẩu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
      });
    }

    const rawToken = (dto.token ?? '').trim();
    if (!rawToken) {
      throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
    }

    const newPassword = dto.newPassword ?? '';
    assertPasswordWithinLimit(newPassword, 'Mật khẩu');

    if (dto.confirmPassword !== undefined && dto.confirmPassword !== newPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    // Verify token validity BEFORE spending CPU on bcrypt hashing to prevent public CPU DoS
    const existingToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (
      !existingToken ||
      existingToken.usedAt !== null ||
      existingToken.expiresAt.getTime() <= now.getTime()
    ) {
      throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
    }

    const passwordHash = await hashPassword(newPassword);

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

      await tx.passwordResetToken.updateMany({
        where: {
          userId: existingToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.user.update({
        where: { id: existingToken.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }
}
