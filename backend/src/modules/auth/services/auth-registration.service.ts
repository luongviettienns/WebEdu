import crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import {
  acquireEmailCooldownOrThrow,
  assertRateLimitNotExceeded,
} from '../../../common/auth/auth-rate-limit.util.js';
import {
  assertPasswordWithinLimit,
  hashPassword,
} from '../../../common/auth/password-hash.util.js';
import {
  CONSENT_TEXT_V1_0,
  CONSENT_VERSION,
  type AuthUserDto,
} from '../../../common/auth/auth.types.js';
import { MailService } from '../../../common/mail/mail.service.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import {
  EMAIL_REGEX,
  PHONE_REGEX,
} from '../../../common/utils/contact-validation.util.js';
import { rethrowDuplicateContactConflict } from '../../../common/utils/prisma-error.util.js';
import {
  calculateAgeInVnTimezone,
  formatIsoDateUtc,
} from '../../../common/utils/timezone.util.js';
import type { RegisterDto } from '../dto/auth.dto.js';
import { AuthSessionService } from './auth-session.service.js';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_REQUESTS_PER_IP = 15;
const MAX_REGISTER_ATTEMPTS_PER_IP = 25;
const IP_AUTH_WINDOW_MS = 15 * 60 * 1000;

export interface RequestClientMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface AtomicVerifyRow {
  id: string;
  code_hash: string;
  attempts: number;
  verified_at: Date | null;
}

@Injectable()
export class AuthRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: AuthSessionService,
    private readonly mailService: MailService,
  ) {}

  async sendVerificationCode(
    rawEmail: string,
    clientIp?: string,
  ): Promise<{ message: string; expiresInSeconds: number }> {
    const email = (rawEmail ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    if (clientIp && clientIp !== 'unknown') {
      await assertRateLimitNotExceeded(this.prisma, {
        key: `otp:ip:${clientIp}`,
        maxPoints: MAX_OTP_REQUESTS_PER_IP,
        windowMs: IP_AUTH_WINDOW_MS,
        blockDurationMs: IP_AUTH_WINDOW_MS,
        errorMessage:
          'Quá nhiều yêu cầu gửi mã xác thực từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
      });
    }

    // Intentional UX trade-off (documented in decision-log): fail early on existing
    // email with 409 so registration distinguishes Email vs Phone conflicts clearly.
    const existingUser = await this.prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác',
      );
    }

    const emailCooldownHash = crypto
      .createHash('sha256')
      .update(`otp:${email}`)
      .digest('hex');
    await acquireEmailCooldownOrThrow(
      this.prisma,
      emailCooldownHash,
      60_000,
      'Vui lòng đợi 60 giây trước khi yêu cầu mã xác thực mới',
    );

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const createdVerification = await this.prisma.emailVerification.create({
      data: {
        email,
        codeHash,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendVerificationCodeEmail({
        toEmail: email,
        code,
        expiresInMinutes: 10,
      });
    } catch (err: unknown) {
      await Promise.allSettled([
        this.prisma.emailVerification.deleteMany({
          where: { id: createdVerification.id },
        }),
        this.prisma.emailRateLimit.deleteMany({
          where: { emailHash: emailCooldownHash },
        }),
      ]);
      throw err;
    }

    return {
      message: 'Mã xác thực đã được gửi tới email của bạn (hiệu lực 10 phút)',
      expiresInSeconds: 600,
    };
  }

  /**
   * Atomically increments attempts and consumes the latest unverified OTP row in PostgreSQL.
   * Outer WHERE repeats `verified_at IS NULL` & `expires_at > now` so concurrent READ COMMITTED
   * EPQ re-checks cannot double-consume or revert `verified_at` back to NULL.
   */
  async verifyCodeOrThrow(email: string, code?: string): Promise<void> {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const trimmedCode = (code ?? '').trim();
    if (!trimmedCode) {
      throw new BadRequestException('Vui lòng nhập mã xác thực đã gửi tới email');
    }

    const now = new Date();
    const inputHash = crypto.createHash('sha256').update(trimmedCode).digest('hex');

    const updatedRows = await this.prisma.$queryRaw<AtomicVerifyRow[]>`
      UPDATE "email_verifications"
      SET
        "attempts" = "attempts" + 1,
        "verified_at" = CASE WHEN "code_hash" = ${inputHash} THEN ${now} ELSE "verified_at" END
      WHERE "id" = (
        SELECT "id" FROM "email_verifications"
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
      const latest = await this.prisma.emailVerification.findFirst({
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

  async register(
    dto: RegisterDto,
    meta?: RequestClientMeta,
  ): Promise<{ message: string; user: AuthUserDto }> {
    const clientIp = meta?.ipAddress?.slice(0, 64);
    if (clientIp && clientIp !== 'unknown') {
      await assertRateLimitNotExceeded(this.prisma, {
        key: `register:ip:${clientIp}`,
        maxPoints: MAX_REGISTER_ATTEMPTS_PER_IP,
        windowMs: IP_AUTH_WINDOW_MS,
        blockDurationMs: IP_AUTH_WINDOW_MS,
        errorMessage:
          'Quá nhiều yêu cầu đăng ký từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
      });
    }

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
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
    }

    const password = dto.password ?? '';
    assertPasswordWithinLimit(password, 'Mật khẩu');

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

    if (age >= 12 && age < 16 && dto.guardianConsent !== true) {
      throw new BadRequestException('Vui lòng xác nhận đã có sự đồng ý của cha mẹ');
    }

    await this.verifyCodeOrThrow(email, dto.verificationCode);

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });
    if (existing) {
      if (existing.email === email && existing.phone === phone) {
        throw new ConflictException('Email và số điện thoại này đã được sử dụng');
      }
      if (existing.email === email) {
        throw new ConflictException(
          'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác',
        );
      }
      throw new ConflictException('Số điện thoại này đã được đăng ký');
    }

    const passwordHash = await hashPassword(password);

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
            guardianEmail: age < 16 ? email : null,
          },
        });

        if (age >= 12 && age < 16) {
          await tx.guardianConsent.create({
            data: {
              studentProfileId: studentProfile.id,
              guardianEmail: email,
              consented: true,
              consentVersion: CONSENT_VERSION,
              consentTextSnapshot: CONSENT_TEXT_V1_0,
              ipAddress: clientIp || null,
              userAgent: meta?.userAgent?.slice(0, 500) || null,
            },
          });
        }

        return { user, studentProfile };
      });

      return {
        message: 'Đăng ký thành công, đang chờ xếp lớp',
        user: this.sessionService.toAuthUserDto({
          ...createdUser.user,
          studentProfile: createdUser.studentProfile,
        }),
      };
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }
}
