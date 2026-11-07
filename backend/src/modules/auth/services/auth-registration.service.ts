import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  CONSENT_TEXT_V1_0,
  CONSENT_VERSION,
  type AuthUserDto,
} from '../../../common/auth/auth.types.js';
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

export interface RequestClientMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: AuthSessionService,
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
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
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

      return {
        message: 'Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp',
        user: this.sessionService.toAuthUserDto(createdUser, dobStr),
      };
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }
}
