import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import type { AuthenticatedUser, JwtPayload } from '../auth/auth.types.js';
import { getHighestRole } from '../auth/role-hierarchy.util.js';
import { TokenService } from '../auth/token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivityTrackerService } from './activity-tracker.service.js';

export const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

@Injectable()
export class SessionValidatorService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly activityTracker: ActivityTrackerService,
  ) {}

  async validateSession(token: string): Promise<AuthenticatedUser> {
    let payload: JwtPayload;
    try {
      payload = await this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        roles: true,
        status: true,
        tokenVersion: true,
        lastActivityAt: true,
      },
    });

    if (!userRecord) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    if (userRecord.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('Tài khoản đã bị khóa, vui lòng liên hệ trung tâm');
    }

    if (userRecord.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại');
    }

    const now = new Date();
    if (
      userRecord.lastActivityAt &&
      now.getTime() - userRecord.lastActivityAt.getTime() > IDLE_TIMEOUT_MS
    ) {
      await this.prisma.user.updateMany({
        where: {
          id: userRecord.id,
          tokenVersion: userRecord.tokenVersion,
        },
        data: {
          tokenVersion: { increment: 1 },
        },
      });
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn do không hoạt động quá 60 phút',
      );
    }

    await this.activityTracker.recordIfDue(
      userRecord.id,
      userRecord.lastActivityAt,
      now,
    );

    return {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.fullName,
      phone: userRecord.phone,
      roles: userRecord.roles,
      effectiveRole: getHighestRole(userRecord.roles),
      status: userRecord.status,
      tokenVersion: userRecord.tokenVersion,
      rememberMe: payload.rememberMe === true,
    };
  }
}
