import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import type { JwtPayload } from './auth.types.js';

export const AUTH_COOKIE_NAME = 'webedu_access_token';
export const ACCESS_TOKEN_TTL_SECONDS = 3600;
export const REMEMBER_ME_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  getAccessTokenTtlSeconds(rememberMe = false): number {
    return rememberMe ? REMEMBER_ME_TTL_SECONDS : ACCESS_TOKEN_TTL_SECONDS;
  }

  async signAccessToken(
    user: { id: string; email: string; tokenVersion: number },
    rememberMe = false,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const expiresIn = this.getAccessTokenTtlSeconds(rememberMe);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      ...(rememberMe ? { rememberMe: true } : {}),
    };
    const secret = this.configService.get<string>('JWT_SECRET');
    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: rememberMe ? '7d' : ACCESS_TOKEN_TTL_SECONDS,
    });
    return { accessToken, expiresIn };
  }

  verifyAccessToken(token: string): Promise<JwtPayload> {
    const secret = this.configService.get<string>('JWT_SECRET');
    return this.jwtService.verifyAsync<JwtPayload>(token, { secret });
  }

  private getBaseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }

  setAuthCookie(
    response: Response,
    accessToken: string,
    expiresInSeconds: number,
  ): void {
    response.cookie(AUTH_COOKIE_NAME, accessToken, {
      ...this.getBaseCookieOptions(),
      maxAge: expiresInSeconds * 1000,
    });
  }

  clearAuthCookie(response: Response | undefined): void {
    response?.clearCookie(AUTH_COOKIE_NAME, this.getBaseCookieOptions());
  }
}
