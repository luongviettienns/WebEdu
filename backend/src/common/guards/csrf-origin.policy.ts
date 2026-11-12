import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfOriginPolicy {
  constructor(private readonly configService: ConfigService) {}

  isStateChangingMethod(method?: string): boolean {
    return STATE_CHANGING_METHODS.has((method ?? '').toUpperCase());
  }

  private getAllowedOrigins(): string[] {
    const corsOriginEnv =
      this.configService.get<string>('CORS_ORIGIN') ??
      process.env.CORS_ORIGIN ??
      'http://localhost:3000';
    return corsOriginEnv
      .split(',')
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }

  verifyExplicitOriginIfPresent(request: Request): void {
    const rawOrigin = request.headers?.origin;
    if (typeof rawOrigin === 'string' && rawOrigin.trim().length > 0) {
      const normalizedOrigin = rawOrigin.trim().replace(/\/+$/, '');
      if (!this.getAllowedOrigins().includes(normalizedOrigin)) {
        throw new ForbiddenException('Nguồn gửi yêu cầu (Origin) không hợp lệ');
      }
    }
  }

  verifyCookieCsrfOrigin(request: Request): void {
    const allowedOrigins = this.getAllowedOrigins();

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
}
