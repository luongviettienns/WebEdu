import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClassStatus, Prisma, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { sanitizeAuditMetadata } from '../../common/utils/audit-sanitize.util.js';
import { rethrowDuplicateContactConflict } from '../../common/utils/prisma-error.util.js';
import type { JwtPayload } from '../../common/auth/auth.types.js';
import { getHighestRole } from '../../common/auth/role-hierarchy.util.js';
import { formatIsoDateUtc } from '../auth/auth.service.js';
import type { ChangePasswordDto, UpdateProfileDto } from './dto/profile.dto.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9}$/;

export interface UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Role[];
  effectiveRole: Role;
  status: UserStatus;
  dateOfBirth?: string;
  assignedClass?: string | null;
  activeClassesCount?: number;
}

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

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async signFreshAccessToken(
    user: {
      id: string;
      email: string;
      tokenVersion: number;
    },
    rememberMe = false,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const expiresIn = rememberMe ? 7 * 24 * 60 * 60 : 3600;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      ...(rememberMe ? { rememberMe: true } : {}),
    };
    const secret = this.configService.get<string>('JWT_SECRET');
    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: rememberMe ? '7d' : 3600,
    });
    return { accessToken, expiresIn };
  }

  async getMyProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        teacherProfile: true,
        _count: {
          select: {
            taughtClasses: {
              where: {
                status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const activeClassesCount = Math.max(
      user.teacherProfile?.activeClassesCount ?? 0,
      user._count?.taughtClasses ?? 0,
    );

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles: user.roles,
      effectiveRole: getHighestRole(user.roles),
      status: user.status,
      ...(user.studentProfile?.dateOfBirth
        ? { dateOfBirth: formatIsoDateUtc(user.studentProfile.dateOfBirth) }
        : {}),
      ...(user.studentProfile
        ? { assignedClass: user.studentProfile.assignedClass ?? null }
        : {}),
      ...(user.roles.includes(Role.TEACHER) ? { activeClassesCount } : {}),
    };
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto & Record<string, unknown>,
    options?: { rememberMe?: boolean },
  ): Promise<RotatedProfileResult> {
    if ('dateOfBirth' in dto && dto.dateOfBirth !== undefined) {
      throw new BadRequestException('Học viên không được phép tự sửa ngày sinh');
    }

    if (dto.fullName !== undefined && !dto.fullName.trim()) {
      throw new BadRequestException('Họ và tên không được để trống');
    }

    if (dto.phone !== undefined && !PHONE_REGEX.test(dto.phone.trim())) {
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
    }

    if (
      dto.email !== undefined &&
      !EMAIL_REGEX.test(dto.email.trim().toLowerCase())
    ) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const preReadUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!preReadUser) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const candidateEmailPre =
      dto.email !== undefined
        ? dto.email.trim().toLowerCase()
        : preReadUser.email;
    let preVerifiedHash: string | null = null;
    if (candidateEmailPre !== preReadUser.email) {
      const currentPwd = dto.currentPassword ?? '';
      if (!currentPwd) {
        throw new BadRequestException('Mật khẩu hiện tại không đúng');
      }
      const isValidPwd = await bcrypt.compare(
        currentPwd,
        preReadUser.passwordHash,
      );
      if (!isValidPwd) {
        throw new BadRequestException('Mật khẩu hiện tại không đúng');
      }
      preVerifiedHash = preReadUser.passwordHash;
    }

    try {
      const { updated, isEmailChanged } = await this.prisma.$transaction(
        async (tx) => {
          if (typeof tx.$queryRaw === 'function') {
            await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
          }

          const user = await tx.user.findUnique({
            where: { id: userId },
            include: { studentProfile: true },
          });

          if (!user) {
            throw new NotFoundException('Tài khoản không tồn tại');
          }

          const nextFullName =
            dto.fullName !== undefined ? dto.fullName.trim() : user.fullName;
          const nextPhone =
            dto.phone !== undefined ? dto.phone.trim() : user.phone;
          const nextEmail =
            dto.email !== undefined
              ? dto.email.trim().toLowerCase()
              : user.email;

          const emailChanged = nextEmail !== user.email;
          if (emailChanged) {
            const currentPwd = dto.currentPassword ?? '';
            if (!currentPwd) {
              throw new BadRequestException('Mật khẩu hiện tại không đúng');
            }
            if (preVerifiedHash !== user.passwordHash) {
              const isValidFreshPwd = await bcrypt.compare(
                currentPwd,
                user.passwordHash,
              );
              if (!isValidFreshPwd) {
                throw new BadRequestException('Mật khẩu hiện tại không đúng');
              }
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
            include: {
              studentProfile: true,
              teacherProfile: true,
              _count: {
                select: {
                  taughtClasses: {
                    where: {
                      status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
                    },
                  },
                },
              },
            },
          });

          await tx.systemAuditLog.create({
            data: {
              actorId: userId,
              actingRole: getHighestRole(updatedUser.roles),
              action: 'UPDATE_MY_PROFILE',
              targetType: 'User',
              targetId: userId,
              metadata: sanitizeAuditMetadata({
                fullName: updatedUser.fullName,
                phone: updatedUser.phone,
                emailChanged,
                previousEmail: emailChanged ? user.email : undefined,
                newEmail: emailChanged ? nextEmail : undefined,
              }) as Prisma.InputJsonValue,
            },
          });

          return { updated: updatedUser, isEmailChanged: emailChanged };
        },
      );

      const rotatedSession = isEmailChanged
        ? await this.signFreshAccessToken(updated, options?.rememberMe === true)
        : undefined;

      const activeClassesCount = Math.max(
        updated.teacherProfile?.activeClassesCount ?? 0,
        updated._count?.taughtClasses ?? 0,
      );

      return {
        profile: {
          id: updated.id,
          email: updated.email,
          fullName: updated.fullName,
          phone: updated.phone,
          roles: updated.roles,
          effectiveRole: getHighestRole(updated.roles),
          status: updated.status,
          ...(updated.studentProfile?.dateOfBirth
            ? { dateOfBirth: formatIsoDateUtc(updated.studentProfile.dateOfBirth) }
            : {}),
          ...(updated.studentProfile
            ? { assignedClass: updated.studentProfile.assignedClass ?? null }
            : {}),
          ...(updated.roles.includes(Role.TEACHER) ? { activeClassesCount } : {}),
        },
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
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    const newPassword = dto.newPassword ?? '';
    if (newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự');
    }
    if (newPassword.length > 72) {
      throw new BadRequestException('Mật khẩu mới không được vượt quá 72 ký tự');
    }

    if (dto.confirmPassword !== undefined && dto.confirmPassword !== newPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const isSameAsOld =
      newPassword === currentPassword ||
      (await bcrypt.compare(newPassword, user.passwordHash));
    if (isSameAsOld) {
      throw new BadRequestException('Mật khẩu mới không được trùng mật khẩu hiện tại');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.systemAuditLog.create({
        data: {
          actorId: userId,
          actingRole: getHighestRole(updatedUser.roles),
          action: 'CHANGE_PASSWORD',
          targetType: 'User',
          targetId: userId,
          metadata: sanitizeAuditMetadata({
            passwordRotated: true,
          }) as Prisma.InputJsonValue,
        },
      });

      return updatedUser;
    });

    const { accessToken, expiresIn } = await this.signFreshAccessToken(
      updated,
      options?.rememberMe === true,
    );

    return { message: 'Đổi mật khẩu thành công', accessToken, expiresIn };
  }
}
