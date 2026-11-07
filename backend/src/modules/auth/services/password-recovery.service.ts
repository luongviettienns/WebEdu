import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { MailService } from '../../../common/mail/mail.service.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { EMAIL_REGEX } from '../../../common/utils/contact-validation.util.js';
import type { ForgotPasswordDto, ResetPasswordDto } from '../dto/auth.dto.js';
import { DUMMY_PASSWORD_HASH } from './auth-login.service.js';

const FORGOT_PASSWORD_COOLDOWN_MS = 60 * 1000; // 60 seconds (FUNC-005)
const RATE_LIMIT_RETENTION_MS = 10 * 60 * 1000; // 10 minutes cleanup window
const RESET_TOKEN_TTL_MINUTES = 15;
const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60 * 1000; // 15 minutes (FUNC-005)

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto): Promise<{
    message: string;
    cooldownSeconds: number;
  }> {
    const normalizedEmail = (dto.email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const emailHash = crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex');
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
