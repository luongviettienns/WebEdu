import type { Request } from 'express';
import { AUTH_COOKIE_NAME } from '../auth/token.service.js';

export type ExtractedAuthToken =
  | { token: string; source: 'bearer' | 'cookie' }
  | undefined;

export function extractAuthToken(
  request: Request & { cookies?: Record<string, string> },
): ExtractedAuthToken {
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7).trim();
    if (bearerToken) {
      return { token: bearerToken, source: 'bearer' };
    }
  }
  const cookieValue = request.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieValue === 'string' && cookieValue.trim().length > 0) {
    return {
      token: cookieValue.trim(),
      source: 'cookie',
    };
  }
  return undefined;
}
