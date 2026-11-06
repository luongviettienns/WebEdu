import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service.js';
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
  accessToken?: string;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async signFreshAccessToken(user: {
    id: string;
    email: string;
    tokenVersion: number;
  }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
    };
    const secret = this.configService.get<string>('JWT_SECRET');
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: 3600,
    });
  }

  async getMyProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

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
    };
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateProfileDto & Record<string, unknown>,
  ): Promise<UserProfileDto> {
    if ('dateOfBirth' in dto && dto.dateOfBirth !== undefined) {
      throw new BadRequestException('Học viên không được phép tự sửa ngày sinh');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const nextFullName =
      dto.fullName !== undefined ? dto.fullName.trim() : user.fullName;
    if (!nextFullName) {
      throw new BadRequestException('Họ và tên không được để trống');
    }

    const nextPhone = dto.phone !== undefined ? dto.phone.trim() : user.phone;
    if (!PHONE_REGEX.test(nextPhone)) {
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
    }

    const nextEmail =
      dto.email !== undefined ? dto.email.trim().toLowerCase() : user.email;
    if (!EMAIL_REGEX.test(nextEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const isEmailChanged = nextEmail !== user.email;
    if (isEmailChanged) {
      const currentPwd = dto.currentPassword ?? '';
      if (!currentPwd) {
        throw new BadRequestException('Mật khẩu hiện tại không đúng');
      }
      const isValidPwd = await bcrypt.compare(currentPwd, user.passwordHash);
      if (!isValidPwd) {
        throw new BadRequestException('Mật khẩu hiện tại không đúng');
      }
    }

    if (isEmailChanged || nextPhone !== user.phone) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [{ email: nextEmail }, { phone: nextPhone }],
        },
      });
      if (duplicate) {
        throw new ConflictException('Email/Số điện thoại đã được sử dụng');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: nextFullName,
        phone: nextPhone,
        email: nextEmail,
        ...(isEmailChanged ? { tokenVersion: { increment: 1 } } : {}),
      },
      include: { studentProfile: true },
    });

    const freshToken = isEmailChanged
      ? await this.signFreshAccessToken(updated)
      : undefined;

    return {
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
      ...(freshToken ? { accessToken: freshToken } : {}),
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string; accessToken: string }> {
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
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    const accessToken = await this.signFreshAccessToken(updated);

    return { message: 'Đổi mật khẩu thành công', accessToken };
  }
}
