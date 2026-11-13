import crypto from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { MailService, VerificationCodePurpose } from '../mail/mail.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_REGEX, normalizeEmail } from '../utils/contact-validation.util.js';
import {
  acquireEmailCooldownOrThrow,
  assertRateLimitNotExceeded,
} from './auth-rate-limit.util.js';

export const MAX_OTP_ATTEMPTS = 5;
export const MAX_OTP_REQUESTS_PER_IP = 15;
export const IP_OTP_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_OTP_COOLDOWN_MS = 60_000;
export const EMAIL_OTP_EXPIRES_MINUTES = 10;

interface AtomicVerifyRow {
  id: string;
  code_hash: string;
  attempts: number;
  verified_at: Date | null;
}

export interface IssueEmailVerificationOtpParams {
  prisma: PrismaService;
  mailService: MailService;
  rawEmail: string;
  purpose: VerificationCodePurpose;
  clientIp?: string;
  ipRateLimitKeyPrefix?: string;
  cooldownKeyPrefix?: string;
  extraRateLimit?: {
    key: string;
    maxPoints: number;
    windowMs: number;
    blockDurationMs: number;
    errorMessage: string;
  };
  duplicateCheckWhere?: Prisma.UserWhereInput;
  duplicateErrorMessage?: string;
}

/**
 * Shared 6-digit email OTP issuance helper: validates syntax, applies IP/custom/cooldown
 * rate limits, checks email conflicts, persists hashed OTP, and rolls back on SMTP error.
 */
export async function issueEmailVerificationOtp(
  params: IssueEmailVerificationOtpParams,
): Promise<{ message: string; expiresInSeconds: number }> {
  const email = normalizeEmail(params.rawEmail ?? '');
  if (!EMAIL_REGEX.test(email)) {
    throw new BadRequestException('Email không hợp lệ');
  }

  const ipPrefix = params.ipRateLimitKeyPrefix ?? 'otp:ip';
  if (params.clientIp && params.clientIp !== 'unknown') {
    await assertRateLimitNotExceeded(params.prisma, {
      key: `${ipPrefix}:${params.clientIp}`,
      maxPoints: MAX_OTP_REQUESTS_PER_IP,
      windowMs: IP_OTP_WINDOW_MS,
      blockDurationMs: IP_OTP_WINDOW_MS,
      errorMessage:
        'Quá nhiều yêu cầu gửi mã xác thực từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
    });
  }

  if (params.extraRateLimit) {
    await assertRateLimitNotExceeded(params.prisma, params.extraRateLimit);
  }

  if (params.duplicateCheckWhere) {
    const existingUser = await params.prisma.user.findFirst({
      where: params.duplicateCheckWhere,
    });
    if (existingUser) {
      throw new ConflictException(
        params.duplicateErrorMessage ??
          'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác',
      );
    }
  }

  const cooldownPrefix = params.cooldownKeyPrefix ?? 'otp';
  const emailCooldownHash = crypto
    .createHash('sha256')
    .update(`${cooldownPrefix}:${email}`)
    .digest('hex');
  await acquireEmailCooldownOrThrow(
    params.prisma,
    emailCooldownHash,
    EMAIL_OTP_COOLDOWN_MS,
    'Vui lòng đợi 60 giây trước khi yêu cầu mã xác thực mới',
  );

  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + EMAIL_OTP_EXPIRES_MINUTES * 60 * 1000);

  const createdVerification = await params.prisma.emailVerification.create({
    data: {
      email,
      codeHash,
      expiresAt,
    },
  });

  try {
    await params.mailService.sendVerificationCodeEmail({
      toEmail: email,
      code,
      expiresInMinutes: EMAIL_OTP_EXPIRES_MINUTES,
      purpose: params.purpose,
    });
  } catch (err: unknown) {
    await Promise.allSettled([
      params.prisma.emailVerification.deleteMany({
        where: { id: createdVerification.id },
      }),
      params.prisma.emailRateLimit.deleteMany({
        where: { emailHash: emailCooldownHash },
      }),
    ]);
    throw err;
  }

  return {
    message: `Mã xác thực đã được gửi tới email của bạn (hiệu lực ${EMAIL_OTP_EXPIRES_MINUTES} phút)`,
    expiresInSeconds: EMAIL_OTP_EXPIRES_MINUTES * 60,
  };
}

/**
 * Atomically checks and consumes the latest active email OTP for `email`.
 * SQL parameter positions are kept compatible with existing registration tests.
 */
export async function verifyEmailVerificationCodeOrThrow(
  prisma: PrismaService,
  email: string,
  code?: string,
): Promise<void> {
  const normalizedEmail = normalizeEmail(email ?? '');
  const trimmedCode = (code ?? '').trim();
  if (!trimmedCode) {
    throw new BadRequestException('Vui lòng nhập mã xác thực đã gửi tới email');
  }

  const now = new Date();
  const inputHash = crypto.createHash('sha256').update(trimmedCode).digest('hex');
  const updatedRows = await prisma.$queryRaw<AtomicVerifyRow[]>`
    UPDATE "email_verifications"
    SET
      "attempts" = "attempts" + 1,
      "verified_at" = CASE WHEN "code_hash" = ${inputHash} THEN ${now} ELSE "verified_at" END
    WHERE "id" = (
      SELECT "id"
      FROM "email_verifications"
      WHERE "email" = ${normalizedEmail}
        AND "verified_at" IS NULL
        AND "expires_at" > ${now}
      ORDER BY "created_at" DESC
      LIMIT 1
    )
    AND "attempts" < ${MAX_OTP_ATTEMPTS}
    AND "verified_at" IS NULL
    AND "expires_at" > ${now}
    RETURNING "id", "code_hash", "attempts", "verified_at"
  `;

  const updated = updatedRows[0];
  if (!updated) {
    const latest = await prisma.emailVerification.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (
      latest &&
      latest.verifiedAt === null &&
      latest.expiresAt.getTime() > now.getTime() &&
      latest.attempts >= MAX_OTP_ATTEMPTS
    ) {
      throw new BadRequestException(
        'Bạn đã nhập sai mã xác thực quá nhiều lần. Vui lòng yêu cầu mã mới',
      );
    }

    throw new BadRequestException(
      'Mã xác thực không tồn tại hoặc đã hết hạn. Vui lòng yêu cầu mã mới',
    );
  }

  if (updated.verified_at === null) {
    throw new BadRequestException('Mã xác thực không chính xác');
  }
}

/** Issues an email-change OTP with IP + per-user rate limits, duplicate check, and 60s cooldown. */
export async function issueProfileEmailChangeOtp(
  prisma: PrismaService,
  mailService: MailService,
  userId: string,
  newEmail: string,
  clientIp?: string,
): Promise<{ message: string; expiresInSeconds: number }> {
  return issueEmailVerificationOtp({
    prisma,
    mailService,
    rawEmail: newEmail,
    purpose: 'email_change',
    clientIp,
    ipRateLimitKeyPrefix: 'profile-email-otp:ip',
    cooldownKeyPrefix: 'email-change-otp',
    extraRateLimit: {
      key: `profile-email-otp:user:${userId}`,
      maxPoints: 10,
      windowMs: IP_OTP_WINDOW_MS,
      blockDurationMs: IP_OTP_WINDOW_MS,
      errorMessage:
        'Quá nhiều yêu cầu gửi mã xác thực đổi email. Vui lòng thử lại sau 15 phút',
    },
    duplicateCheckWhere: { id: { not: userId }, email: newEmail },
    duplicateErrorMessage: 'Email/Số điện thoại đã được sử dụng',
  });
}
