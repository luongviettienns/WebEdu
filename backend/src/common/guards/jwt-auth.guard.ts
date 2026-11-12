import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AUTH_COOKIE_NAME, TokenService } from '../auth/token.service.js';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator.js';
import { extractAuthToken } from './auth-token.extractor.js';
import { CsrfOriginPolicy } from './csrf-origin.policy.js';
import { IDLE_TIMEOUT_MS, SessionValidatorService } from './session-validator.service.js';

export { AUTH_COOKIE_NAME, IDLE_TIMEOUT_MS };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly csrfOriginPolicy: CsrfOriginPolicy,
    private readonly sessionValidator: SessionValidatorService,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<
      Request & { user?: AuthenticatedUser; cookies?: Record<string, string> }
    >();
    const response = httpCtx.getResponse<Response | undefined>();

    if (isPublic) {
      if (this.csrfOriginPolicy.isStateChangingMethod(request.method)) {
        this.csrfOriginPolicy.verifyExplicitOriginIfPresent(request);
      }
      return true;
    }

    const extracted = extractAuthToken(request);
    if (!extracted) {
      throw new UnauthorizedException('Vui lòng đăng nhập để tiếp tục');
    }

    if (
      extracted.source === 'cookie' &&
      this.csrfOriginPolicy.isStateChangingMethod(request.method)
    ) {
      this.csrfOriginPolicy.verifyCookieCsrfOrigin(request);
    }

    try {
      request.user = await this.sessionValidator.validateSession(extracted.token);
      return true;
    } catch (error) {
      if (
        extracted.source === 'cookie' &&
        (error instanceof UnauthorizedException || error instanceof ForbiddenException)
      ) {
        this.tokenService.clearAuthCookie(response);
      }
      throw error;
    }
  }
}
