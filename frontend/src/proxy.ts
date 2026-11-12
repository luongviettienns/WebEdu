import { NextResponse, type NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'webedu_access_token';

function isTokenStructurallyValid(rawToken?: string): boolean {
  if (!rawToken || !rawToken.trim()) {
    return false;
  }
  const parts = rawToken.trim().split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return false;
  }
  try {
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = atob(padded);
    const payload = JSON.parse(json) as { sub?: unknown; exp?: unknown };
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return false;
    }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Edge/Server route guard for protected Portal routes (`SEC-RISK-05`).
 * Redirects unauthenticated or clearly expired sessions to `/login` before
 * rendering client portal UI (eliminating auth redirect flicker).
 * Authoritative RBAC & tokenVersion checks remain on the NestJS backend.
 */
export function proxy(request: NextRequest): NextResponse {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!isTokenStructurallyValid(token)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/teacher',
    '/teacher/:path*',
    '/student',
    '/student/:path*',
    '/superadmin',
    '/superadmin/:path*',
    '/profile',
    '/profile/:path*',
  ],
};
