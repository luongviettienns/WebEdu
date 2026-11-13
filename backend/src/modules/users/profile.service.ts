import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../common/audit/audit-log.util.js';
import {
  assertValidContactFields,
  EMAIL_REGEX,
  normalizeEmail,
} from '../../common/utils/contact-validation.util.js';
import { rethrowDuplicateContactConflict } from '../../common/utils/prisma-error.util.js';
import {
  assertPasswordWithinLimit,
  comparePassword,
  hashPassword,
} from '../../common/auth/password-hash.util.js';
import {
  issueProfileEmailChangeOtp,
  verifyEmailVerificationCodeOrThrow,
} from '../../common/auth/email-otp.util.js';
import { getHighestRole } from '../../common/auth/role-hierarchy.util.js';
import { TokenService } from '../../common/auth/token.service.js';
import { MailService } from '../../common/mail/mail.service.js';
import type {
  ChangePasswordDto,
  SendEmailChangeCodeDto,
  UpdateProfileDto,
} from './dto/profile.dto.js';
import {
  isStudentUnder16,
  PROFILE_USER_INCLUDE,
  toUserProfileDto,
  type UserProfileDto,
} from './mappers/profile.mapper.js';

export { type UserProfileDto };

export interface RotatedProfileResult {
  profile: UserProfileDto;
  rotatedSession?: {
    accessToken: string;
    expiresIn: number;
  };
}

export interface ChangePasswordResult {
  message: string;
  accessToken: string;
  expiresIn: number;
}

const UNDER_16_SELF_EMAIL_CHANGE_ERROR =
  'Học viên dưới 16 tuổi không được phép tự đổi email, vui lòng liên hệ Quản trị viên để được hỗ trợ';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    @Optional() private readonly mailService?: MailService,
  ) {}

  private async assertCurrentPasswordValid(
    password: string | undefined,
    passwordHash: string,
  ): Promise<void> {
    const pwd = password ?? '';
    if (!pwd || !(await comparePassword(pwd, passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
  }

  async getMyProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: PROFILE_USER_INCLUDE,
    });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại');
    return toUserProfileDto(user);
  }

  async sendEmailChangeCode(
    userId: string,
    dto: SendEmailChangeCodeDto,
    clientIp?: string,
  ): Promise<{ message: string; expiresInSeconds: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại');
    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('Tài khoản đã bị khóa');
    }
    if (isStudentUnder16(user)) {
      throw new ForbiddenException(UNDER_16_SELF_EMAIL_CHANGE_ERROR);
    }

    const newEmail = normalizeEmail(dto.newEmail ?? '');
    if (!EMAIL_REGEX.test(newEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }
    if (newEmail === normalizeEmail(user.email)) {
      throw new BadRequestException('Email mới phải khác email hiện tại');
    }
    if (!this.mailService) {
      throw new ServiceUnavailableException('Dịch vụ gửi email chưa sẵn sàng');
    }
    return issueProfileEmailChangeOtp(this.prisma, this.mailService, userId, newEmail, clientIp);
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto,
    options?: { rememberMe?: boolean },
  ): Promise<RotatedProfileResult> {
    if ('dateOfBirth' in dto && dto.dateOfBirth !== undefined) {
      throw new BadRequestException('Học viên không được phép tự sửa ngày sinh');
    }
    assertValidContactFields({ fullName: dto.fullName, phone: dto.phone, email: dto.email });

    const preReadUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });
    if (!preReadUser) throw new NotFoundException('Tài khoản không tồn tại');

    const candidateEmailPre = dto.email !== undefined ? normalizeEmail(dto.email) : preReadUser.email;
    const candidatePhonePre = dto.phone !== undefined ? dto.phone.trim() : preReadUser.phone;
    let preVerifiedHash: string | null = null;
    let preVerifiedOtpEmail: string | null = null;
    if (candidateEmailPre !== preReadUser.email) {
      if (isStudentUnder16(preReadUser)) {
        throw new ForbiddenException(UNDER_16_SELF_EMAIL_CHANGE_ERROR);
      }
      await this.assertCurrentPasswordValid(dto.currentPassword, preReadUser.passwordHash);
      preVerifiedHash = preReadUser.passwordHash;
      const dupPre = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [
            { email: candidateEmailPre },
            ...(candidatePhonePre !== preReadUser.phone ? [{ phone: candidatePhonePre }] : []),
          ],
        },
      });
      if (dupPre) throw new ConflictException('Email/Số điện thoại đã được sử dụng');
      await verifyEmailVerificationCodeOrThrow(this.prisma, candidateEmailPre, dto.verificationCode);
      preVerifiedOtpEmail = candidateEmailPre;
    }

    try {
      const { updated, isEmailChanged } = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;

        const user = await tx.user.findUnique({
          where: { id: userId },
          include: { studentProfile: true },
        });
        if (!user) throw new NotFoundException('Tài khoản không tồn tại');

        const nextFullName = dto.fullName !== undefined ? dto.fullName.trim() : user.fullName;
        const nextPhone = dto.phone !== undefined ? dto.phone.trim() : user.phone;
        const nextEmail = dto.email !== undefined ? normalizeEmail(dto.email) : user.email;

        const emailChanged = nextEmail !== user.email;
        if (emailChanged) {
          if (isStudentUnder16(user)) throw new ForbiddenException(UNDER_16_SELF_EMAIL_CHANGE_ERROR);
          if (preVerifiedHash !== user.passwordHash) {
            await this.assertCurrentPasswordValid(dto.currentPassword, user.passwordHash);
          }
          if (preVerifiedOtpEmail !== nextEmail) {
            await verifyEmailVerificationCodeOrThrow(this.prisma, nextEmail, dto.verificationCode);
          }
        }

          if (emailChanged || nextPhone !== user.phone) {
            const duplicate = await tx.user.findFirst({
              where: {
                id: { not: userId },
                OR: [{ email: nextEmail }, { phone: nextPhone }],
              },
            });
            if (duplicate) {
              throw new ConflictException('Email/Số điện thoại đã được sử dụng');
            }
          }

          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: {
              ...(dto.fullName !== undefined ? { fullName: nextFullName } : {}),
              ...(dto.phone !== undefined ? { phone: nextPhone } : {}),
              ...(dto.email !== undefined ? { email: nextEmail } : {}),
              ...(emailChanged ? { tokenVersion: { increment: 1 } } : {}),
            },
            include: PROFILE_USER_INCLUDE,
          });

          await writeAuditLog(
            tx,
            {
              id: userId,
              effectiveRole: getHighestRole(updatedUser.roles),
            },
            {
              action: 'UPDATE_MY_PROFILE',
              targetType: 'User',
              targetId: userId,
              metadata: {
                fullName: updatedUser.fullName,
                phone: updatedUser.phone,
                emailChanged,
                previousEmail: emailChanged ? user.email : undefined,
                newEmail: emailChanged ? nextEmail : undefined,
              },
            },
          );

          return { updated: updatedUser, isEmailChanged: emailChanged };
        },
      );

      const rotatedSession = isEmailChanged
        ? await this.tokenService.signAccessToken(
            updated,
            options?.rememberMe === true,
          )
        : undefined;

      return {
        profile: toUserProfileDto(updated),
        ...(rotatedSession ? { rotatedSession } : {}),
      };
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    options?: { rememberMe?: boolean },
  ): Promise<ChangePasswordResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const currentPassword = dto.currentPassword ?? '';
    const isCurrentValid = await comparePassword(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    const newPassword = dto.newPassword ?? '';
    assertPasswordWithinLimit(newPassword, 'Mật khẩu mới');

    if (dto.confirmPassword !== undefined && dto.confirmPassword !== newPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const isSameAsOld =
      newPassword === currentPassword ||
      (await comparePassword(newPassword, user.passwordHash));
    if (isSameAsOld) {
      throw new BadRequestException('Mật khẩu mới không được trùng mật khẩu hiện tại');
    }

    const preVerifiedHash = user.passwordHash;
    const passwordHash = await hashPassword(newPassword);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;

      const lockedUser = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!lockedUser) {
        throw new NotFoundException('Tài khoản không tồn tại');
      }
      if (lockedUser.status === UserStatus.INACTIVE) {
        throw new ForbiddenException('Tài khoản đã bị khóa');
      }
      if (lockedUser.passwordHash !== preVerifiedHash) {
        const isCurrentStillValid = await comparePassword(
          currentPassword,
          lockedUser.passwordHash,
        );
        if (!isCurrentStillValid) {
          throw new BadRequestException('Mật khẩu hiện tại không đúng');
        }
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      await writeAuditLog(
        tx,
        {
          id: userId,
          effectiveRole: getHighestRole(updatedUser.roles),
        },
        {
          action: 'CHANGE_PASSWORD',
          targetType: 'User',
          targetId: userId,
          metadata: {
            passwordRotated: true,
          },
        },
      );

      return updatedUser;
    });

    const { accessToken, expiresIn } = await this.tokenService.signAccessToken(
      updated,
      options?.rememberMe === true,
    );

    return { message: 'Đổi mật khẩu thành công', accessToken, expiresIn };
  }
}
