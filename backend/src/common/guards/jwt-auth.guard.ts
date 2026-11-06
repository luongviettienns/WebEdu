import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator.js';
import { getHighestRole } from '../auth/role-hierarchy.util.js';
import type { AuthenticatedUser, JwtPayload } from '../auth/auth.types.js';

export const AUTH_COOKIE_NAME = 'webedu_access_token';
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes (FUNC-004)
const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000; // 60 seconds
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type ExtractedAuthToken =
  | { token: string; source: 'bearer' | 'cookie' }
  | undefined;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser; cookies?: Record<string, string> }>();

    const extracted = this.extractToken(request);
    if (!extracted) {
      throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục');
    }

    if (
      extracted.source === 'cookie' &&
      STATE_CHANGING_METHODS.has(request.method.toUpperCase())
    ) {
      this.verifyCookieCsrfOrigin(request);
    }

    const token = extracted.token;

    let payload: JwtPayload;
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
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
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn do không hoạt động quá 60 phút',
      );
    }

    if (
      !userRecord.lastActivityAt ||
      now.getTime() - userRecord.lastActivityAt.getTime() >= ACTIVITY_UPDATE_THROTTLE_MS
    ) {
      await this.prisma.user.update({
        where: { id: userRecord.id },
        data: { lastActivityAt: now },
      });
    }

    request.user = {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.fullName,
      phone: userRecord.phone,
      roles: userRecord.roles,
      effectiveRole: getHighestRole(userRecord.roles),
      status: userRecord.status,
      tokenVersion: userRecord.tokenVersion,
    };

    return true;
  }

  private verifyCookieCsrfOrigin(request: Request): void {
    const corsOriginEnv =
      this.configService.get<string>('CORS_ORIGIN') ??
      process.env.CORS_ORIGIN ??
      'http://localhost:3000';
    const allowedOrigins = corsOriginEnv
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);

    const rawOrigin = request.headers.origin;
    if (typeof rawOrigin === 'string' && rawOrigin.trim().length > 0) {
      const normalizedOrigin = rawOrigin.trim().replace(/\/+$/, '');
      if (!allowedOrigins.includes(normalizedOrigin)) {
        throw new ForbiddenException('Nguồn gửi yêu cầu (Origin) không hợp lệ');
      }
      return;
    }

    const xRequestedWith = request.headers['x-requested-with'];
    const hasValidXhrHeader =
      typeof xRequestedWith === 'string' &&
      xRequestedWith.trim().toLowerCase() === 'xmlhttprequest';

    let hasValidReferer = false;
    const rawReferer = request.headers.referer;
    if (typeof rawReferer === 'string' && rawReferer.trim().length > 0) {
      try {
        const refererOrigin = new URL(rawReferer.trim()).origin;
        hasValidReferer = allowedOrigins.includes(refererOrigin);
      } catch {
        hasValidReferer = false;
      }
    }

    if (!hasValidXhrHeader && !hasValidReferer) {
      throw new ForbiddenException(
        'Thiếu xác thực nguồn gửi yêu cầu (CSRF Origin/X-Requested-With)',
      );
    }
  }

  private extractToken(
    request: Request & { cookies?: Record<string, string> },
  ): ExtractedAuthToken {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.slice(7).trim();
      if (bearerToken) {
        return { token: bearerToken, source: 'bearer' };
      }
    }
    if (
      request.cookies &&
      typeof request.cookies[AUTH_COOKIE_NAME] === 'string' &&
      request.cookies[AUTH_COOKIE_NAME].trim().length > 0
    ) {
      return {
        token: request.cookies[AUTH_COOKIE_NAME].trim(),
        source: 'cookie',
      };
    }
    return undefined;
  }
}
