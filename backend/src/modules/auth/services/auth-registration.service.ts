import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { assertRateLimitNotExceeded } from '../../../common/auth/auth-rate-limit.util.js';
import {
  issueEmailVerificationOtp,
  verifyEmailVerificationCodeOrThrow,
} from '../../../common/auth/email-otp.util.js';
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
  normalizeEmail,
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
const MAX_REGISTER_ATTEMPTS_PER_IP = 25;
const IP_AUTH_WINDOW_MS = 15 * 60 * 1000;

export interface RequestClientMeta {
  ipAddress?: string;
  userAgent?: string;
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
    const email = normalizeEmail(rawEmail ?? '');
    return issueEmailVerificationOtp({
      prisma: this.prisma,
      mailService: this.mailService,
      rawEmail,
      purpose: 'registration',
      clientIp,
      duplicateCheckWhere: { email },
      duplicateErrorMessage:
        'Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng email khác',
    });
  }

  async verifyCodeOrThrow(email: string, code?: string): Promise<void> {
    return verifyEmailVerificationCodeOrThrow(this.prisma, email, code);
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
