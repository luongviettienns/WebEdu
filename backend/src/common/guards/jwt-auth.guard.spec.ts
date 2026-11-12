import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator.js';
import { TokenService } from '../auth/token.service.js';
import { ActivityTrackerService } from './activity-tracker.service.js';
import { CsrfOriginPolicy } from './csrf-origin.policy.js';
import {
  AUTH_COOKIE_NAME,
  IDLE_TIMEOUT_MS,
  JwtAuthGuard,
} from './jwt-auth.guard.js';
import { SessionValidatorService } from './session-validator.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('JwtAuthGuard', () => {
  const handlerDummy = () => {};
  const classDummy = class {};
  let jwtService: JwtService;
  let configService: ConfigService;
  let configGetMock: ReturnType<typeof vi.fn>;
  let reflector: Reflector;
  let getAllAndOverrideMock: ReturnType<typeof vi.fn>;
  let prismaMock: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };
  let guard: JwtAuthGuard;

  function createHttpContext(options: {
    method?: string;
    headers?: Record<string, string | undefined>;
    cookies?: Record<string, string>;
    clearCookie?: ReturnType<typeof vi.fn>;
  }): {
    context: ExecutionContext;
    request: Record<string, unknown>;
    clearCookie: ReturnType<typeof vi.fn>;
  } {
    const clearCookie = options.clearCookie ?? vi.fn();
    const request: Record<string, unknown> = {
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
      cookies: options.cookies ?? {},
    };
    const response = { clearCookie };
    const context = {
      getHandler: () => handlerDummy,
      getClass: () => classDummy,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    return { context, request, clearCookie };
  }

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'test-jwt-secret' });
    configGetMock = vi.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-jwt-secret';
      if (key === 'CORS_ORIGIN')
        return 'http://localhost:3000, https://webedu.vn/';
      return undefined;
    });
    configService = {
      get: configGetMock,
    } as unknown as ConfigService;
    getAllAndOverrideMock = vi.fn().mockReturnValue(false);
    reflector = {
      getAllAndOverride: getAllAndOverrideMock,
    } as unknown as Reflector;
    prismaMock = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const tokenService = new TokenService(jwtService, configService);
    const csrfOriginPolicy = new CsrfOriginPolicy(configService);
    const activityTracker = new ActivityTrackerService(
      prismaMock as unknown as PrismaService,
    );
    const sessionValidator = new SessionValidatorService(
      tokenService,
      prismaMock as unknown as PrismaService,
      activityTracker,
    );
    guard = new JwtAuthGuard(
      reflector,
      csrfOriginPolicy,
      sessionValidator,
      tokenService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows @Public() GET requests (ignoring Origin) and validates Origin on @Public() POST requests', async () => {
    getAllAndOverrideMock.mockReturnValue(true);

    // Public GET even with untrusted Origin is allowed
    const getCtx = createHttpContext({
      method: 'GET',
      headers: { origin: 'https://evil.example.com' },
    });
    await expect(guard.canActivate(getCtx.context)).resolves.toBe(true);
    expect(getAllAndOverrideMock).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handlerDummy,
      classDummy,
    ]);

    // Public POST without Origin header is allowed
    const noOriginPostCtx = createHttpContext({
      method: 'POST',
      headers: { origin: '   ' },
    });
    await expect(guard.canActivate(noOriginPostCtx.context)).resolves.toBe(true);

    const validPostCtx = createHttpContext({
      method: 'POST',
      headers: { origin: 'http://localhost:3000/' },
    });
    await expect(guard.canActivate(validPostCtx.context)).resolves.toBe(true);

    const evilPostCtx = createHttpContext({
      method: 'POST',
      headers: { origin: 'https://attacker.example.com' },
    });
    await expect(guard.canActivate(evilPostCtx.context)).rejects.toThrow(
      new ForbiddenException('Nguồn gửi yêu cầu (Origin) không hợp lệ'),
    );
  });

  it('rejects unauthenticated requests when Bearer or Cookie tokens are missing or blank', async () => {
    const emptyCtx = createHttpContext({ method: 'GET' });
    await expect(guard.canActivate(emptyCtx.context)).rejects.toThrow(
      new UnauthorizedException('Vui lòng đăng nhập để tiếp tục'),
    );

    const blankBearerAndCookieCtx = createHttpContext({
      method: 'GET',
      headers: { authorization: 'Bearer    ' },
      cookies: { [AUTH_COOKIE_NAME]: '   ' },
    });
    await expect(
      guard.canActivate(blankBearerAndCookieCtx.context),
    ).rejects.toThrow(
      new UnauthorizedException('Vui lòng đăng nhập để tiếp tục'),
    );

    const nonBearerCtx = createHttpContext({
      method: 'GET',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    await expect(guard.canActivate(nonBearerCtx.context)).rejects.toThrow(
      new UnauthorizedException('Vui lòng đăng nhập để tiếp tục'),
    );
  });

  it('enforces CSRF Origin / X-Requested-With / Referer checks on state-changing Cookie requests and skips them for Bearer tokens', async () => {
    const token = await jwtService.signAsync({
      sub: 'u-1',
      email: 'u1@webedu.vn',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      email: 'u1@webedu.vn',
      fullName: 'User One',
      phone: '0901234567',
      roles: [Role.STUDENT],
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      lastActivityAt: new Date(),
    });

    // 1. Missing Origin, X-Requested-With, and Referer on Cookie POST -> 403
    const missingCsrfCtx = createHttpContext({
      method: 'POST',
      cookies: { [AUTH_COOKIE_NAME]: `  ${token}  ` },
    });
    await expect(guard.canActivate(missingCsrfCtx.context)).rejects.toThrow(
      new ForbiddenException(
        'Thiếu xác thực nguồn gửi yêu cầu (CSRF Origin/X-Requested-With)',
      ),
    );

    // 2. Bearer POST without Origin/X-Requested-With -> allowed (no CSRF check needed for Bearer)
    const bearerPostCtx = createHttpContext({
      method: 'POST',
      headers: { authorization: `Bearer   ${token}  ` },
    });
    await expect(guard.canActivate(bearerPostCtx.context)).resolves.toBe(true);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u-1' },
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

    // 3. Untrusted Origin on Cookie PATCH -> 403
    const untrustedOriginCtx = createHttpContext({
      method: 'PATCH',
      headers: { origin: 'https://evil.org' },
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(untrustedOriginCtx.context)).rejects.toThrow(
      new ForbiddenException('Nguồn gửi yêu cầu (Origin) không hợp lệ'),
    );

    // 4. Trusted Origin on Cookie POST -> allowed
    const trustedOriginCtx = createHttpContext({
      method: 'POST',
      headers: { origin: 'https://webedu.vn///' },
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(trustedOriginCtx.context)).resolves.toBe(true);

    // 5. Valid X-Requested-With: XMLHttpRequest without Origin -> 200 allowed
    const xhrCtx = createHttpContext({
      method: 'DELETE',
      headers: { 'x-requested-with': '  XMLHttpRequest  ' },
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(xhrCtx.context)).resolves.toBe(true);

    // 6. Valid Referer matching CORS_ORIGIN without Origin -> 200 allowed
    const refererCtx = createHttpContext({
      method: 'PUT',
      headers: { referer: '  https://webedu.vn/profile/settings  ' },
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(refererCtx.context)).resolves.toBe(true);

    // 7. Malformed Referer without Origin -> 403
    const badRefererCtx = createHttpContext({
      method: 'POST',
      headers: { referer: ':::not-a-valid-url:::' },
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(badRefererCtx.context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('clears auth cookie only when token source is cookie, and verifies JWT_SECRET and CORS_ORIGIN fallbacks', async () => {
    const cookieCtx = createHttpContext({
      method: 'GET',
      cookies: { [AUTH_COOKIE_NAME]: 'invalid.jwt.token' },
    });

    await expect(guard.canActivate(cookieCtx.context)).rejects.toThrow(
      new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn'),
    );
    expect(configGetMock).toHaveBeenCalledWith('JWT_SECRET');
    expect(cookieCtx.clearCookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });

    // Invalid Bearer token must NOT call clearCookie
    const bearerCtx = createHttpContext({
      method: 'GET',
      headers: { authorization: 'Bearer invalid.jwt.token' },
    });
    await expect(guard.canActivate(bearerCtx.context)).rejects.toThrow(
      new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn'),
    );
    expect(bearerCtx.clearCookie).not.toHaveBeenCalled();

    // Verify default CORS_ORIGIN fallback ('http://localhost:3000') when config & env are undefined
    const prevCors = process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN;
    try {
      configGetMock.mockImplementation(
        (key: string) => (key === 'JWT_SECRET' ? 'test-jwt-secret' : undefined),
      );
      getAllAndOverrideMock.mockReturnValue(true);
      const defaultCorsCtx = createHttpContext({
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
      });
      await expect(guard.canActivate(defaultCorsCtx.context)).resolves.toBe(
        true,
      );
    } finally {
      if (prevCors !== undefined) process.env.CORS_ORIGIN = prevCors;
    }
  });

  it('clears auth cookie and throws 401/403 when user is missing, INACTIVE, or has mismatched tokenVersion', async () => {
    const token = await jwtService.signAsync({
      sub: 'u-1',
      email: 'u1@webedu.vn',
      tokenVersion: 2,
    });

    // 1. User not found -> 401
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const missingUserCtx = createHttpContext({
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(missingUserCtx.context)).rejects.toThrow(
      new UnauthorizedException('Tài khoản không tồn tại'),
    );
    expect(missingUserCtx.clearCookie).toHaveBeenCalledTimes(1);

    // 2. User INACTIVE -> 403
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-1',
      email: 'u1@webedu.vn',
      fullName: 'User One',
      phone: '0901234567',
      roles: [Role.STUDENT],
      status: UserStatus.INACTIVE,
      tokenVersion: 2,
      lastActivityAt: new Date(),
    });
    const inactiveCtx = createHttpContext({
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(inactiveCtx.context)).rejects.toThrow(
      new ForbiddenException('Tài khoản đã bị khóa, vui lòng liên hệ trung tâm'),
    );
    expect(inactiveCtx.clearCookie).toHaveBeenCalledTimes(1);

    // 3. tokenVersion mismatch -> 401
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-1',
      email: 'u1@webedu.vn',
      fullName: 'User One',
      phone: '0901234567',
      roles: [Role.STUDENT],
      status: UserStatus.ACTIVE,
      tokenVersion: 3,
      lastActivityAt: new Date(),
    });
    const versionMismatchCtx = createHttpContext({
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(
      guard.canActivate(versionMismatchCtx.context),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại',
      ),
    );
    expect(versionMismatchCtx.clearCookie).toHaveBeenCalledTimes(1);
  });

  it('enforces exact 60-minute idle timeout boundary and exact 60-second activity throttle boundary', async () => {
    vi.useFakeTimers();
    const fixedNow = new Date('2026-04-06T12:00:00.000Z');
    vi.setSystemTime(fixedNow);

    const token = await jwtService.signAsync({
      sub: 'u-idle',
      email: 'idle@webedu.vn',
      tokenVersion: 1,
      rememberMe: true,
    });

    // 1. Expired idle session (> 60m by 1ms)
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-idle',
      email: 'idle@webedu.vn',
      fullName: 'Idle User',
      phone: '0901234567',
      roles: [Role.ADMIN, Role.TEACHER],
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      lastActivityAt: new Date(fixedNow.getTime() - IDLE_TIMEOUT_MS - 1),
    });
    const expiredCtx = createHttpContext({
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    await expect(guard.canActivate(expiredCtx.context)).rejects.toThrow(
      new UnauthorizedException(
        'Phiên đăng nhập đã hết hạn do không hoạt động quá 60 phút',
      ),
    );
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u-idle', tokenVersion: 1 },
      data: { tokenVersion: { increment: 1 } },
    });
    expect(expiredCtx.clearCookie).toHaveBeenCalledTimes(1);

    // 2. Exact 60-minute boundary (elapsed === IDLE_TIMEOUT_MS) -> NOT expired, updates lastActivityAt
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-idle',
      email: 'idle@webedu.vn',
      fullName: 'Idle User',
      phone: '0901234567',
      roles: [Role.TEACHER, Role.ADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      lastActivityAt: new Date(fixedNow.getTime() - IDLE_TIMEOUT_MS),
    });
    const exactIdleBoundaryCtx = createHttpContext({
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(
      guard.canActivate(exactIdleBoundaryCtx.context),
    ).resolves.toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u-idle' },
      data: { lastActivityAt: fixedNow },
    });

    // 3. Exact 60-second activity throttle boundary (elapsed === 60_000ms) -> updates lastActivityAt
    prismaMock.user.update.mockClear();
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-idle',
      email: 'idle@webedu.vn',
      fullName: 'Idle User',
      phone: '0901234567',
      roles: [Role.TEACHER, Role.ADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      lastActivityAt: new Date(fixedNow.getTime() - 60_000),
    });
    const throttleBoundaryCtx = createHttpContext({
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(
      guard.canActivate(throttleBoundaryCtx.context),
    ).resolves.toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);

    // 4. Below 60-second activity throttle (elapsed === 59_999ms) -> does NOT update lastActivityAt
    prismaMock.user.update.mockClear();
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-idle',
      email: 'idle@webedu.vn',
      fullName: 'Idle User',
      phone: '0901234567',
      roles: [Role.TEACHER, Role.ADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      lastActivityAt: new Date(fixedNow.getTime() - 59_999),
    });
    const underThrottleCtx = createHttpContext({
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(underThrottleCtx.context)).resolves.toBe(
      true,
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();

    // 5. Null lastActivityAt -> updates lastActivityAt
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'u-idle',
      email: 'idle@webedu.vn',
      fullName: 'Idle User',
      phone: '0901234567',
      roles: [Role.TEACHER, Role.ADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      lastActivityAt: null,
    });
    const nullActivityCtx = createHttpContext({
      headers: { authorization: `Bearer ${token}` },
    });
    await expect(guard.canActivate(nullActivityCtx.context)).resolves.toBe(
      true,
    );
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    expect(nullActivityCtx.request.user).toEqual({
      id: 'u-idle',
      email: 'idle@webedu.vn',
      fullName: 'Idle User',
      phone: '0901234567',
      roles: [Role.TEACHER, Role.ADMIN],
      effectiveRole: Role.ADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 1,
      rememberMe: true,
    });
  });

  it('does NOT clear the auth cookie when session validation fails due to a transient DB error (LOW-01)', async () => {
    const token = await jwtService.signAsync({
      sub: 'u-db-err',
      email: 'db@webedu.vn',
      tokenVersion: 0,
    });
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('ECONNRESET'));

    const ctx = createHttpContext({
      method: 'GET',
      cookies: { [AUTH_COOKIE_NAME]: token },
    });

    await expect(guard.canActivate(ctx.context)).rejects.toThrow('ECONNRESET');
    expect(ctx.clearCookie).not.toHaveBeenCalled();
  });
});
