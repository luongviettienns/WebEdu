import { Injectable, NotFoundException } from '@nestjs/common';
import type { Role, UserStatus } from '@prisma/client';
import type { AuthUserDto } from '../../../common/auth/auth.types.js';
import {
  getDefaultRedirectByRole,
  getHighestRole,
} from '../../../common/auth/role-hierarchy.util.js';
import { TokenService } from '../../../common/auth/token.service.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';

export interface AuthUserWithOptionalStudentProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
  tokenVersion: number;
  studentProfile?: {
    dateOfBirth: Date;
  } | null;
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  toAuthUserDto(
    user: AuthUserWithOptionalStudentProfile,
    explicitDobStr?: string,
  ): AuthUserDto {
    const effectiveRole = getHighestRole(user.roles);
    const dob =
      explicitDobStr ??
      (user.studentProfile?.dateOfBirth
        ? formatIsoDateUtc(user.studentProfile.dateOfBirth)
        : undefined);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles: user.roles,
      effectiveRole,
      status: user.status,
      ...(dob ? { dateOfBirth: dob } : {}),
    };
  }

  async issueLoginSession(
    user: AuthUserWithOptionalStudentProfile,
    rememberMe: boolean,
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    redirectTo: string;
    user: AuthUserDto;
  }> {
    const { accessToken, expiresIn } = await this.tokenService.signAccessToken(
      user,
      rememberMe,
    );

    const userDto = this.toAuthUserDto(user);
    return {
      accessToken,
      expiresIn,
      redirectTo: getDefaultRedirectByRole(userDto.effectiveRole),
      user: userDto,
    };
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    return this.toAuthUserDto(user);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: { increment: 1 },
      },
    });
    return { message: 'Đăng xuất thành công' };
  }
}
