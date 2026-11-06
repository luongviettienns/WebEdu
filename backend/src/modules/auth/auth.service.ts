import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { calculateAgeInVnTimezone } from '../../common/utils/timezone.util.js';
import {
  CONSENT_TEXT_V1_0,
  CONSENT_VERSION,
  type AuthUserDto,
  type JwtPayload,
} from '../../common/auth/auth.types.js';
import {
  getDefaultRedirectByRole,
  getHighestRole,
} from '../../common/auth/role-hierarchy.util.js';
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('webedu_dummy_anti_timing_secret_2026', 10);
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes (FUNC-003)
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const FORGOT_PASSWORD_COOLDOWN_MS = 60 * 1000; // 60 seconds (FUNC-005)
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes (FUNC-005)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface RequestClientMeta {
  ipAddress?: string;
  userAgent?: string;
}

export function formatIsoDateUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class AuthService {
  private readonly cooldownByEmailHash = new Map<string, number>();
  private readonly loginLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private async withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.loginLocks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chain = previous.then(() => current);
    this.loginLocks.set(key, chain);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.loginLocks.get(key) === chain) {
        this.loginLocks.delete(key);
      }
    }
  }

  async register(
    dto: RegisterDto,
    meta?: RequestClientMeta,
  ): Promise<{ message: string; user: AuthUserDto }> {
    const fullName = (dto.fullName ?? '').trim();
    if (!fullName) {
      throw new BadRequestException('Họ và tên không được để trống');
    }

    const email = (dto.email ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const phone = (dto.phone ?? '').trim();
    if (!PHONE_REGEX.test(phone)) {
      throw new BadRequestException('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0');
    }

    const password = dto.password ?? '';
    if (password.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (password.length > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 ký tự');
    }

    if (dto.confirmPassword !== undefined && dto.confirmPassword !== password) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const dobStr = (dto.dateOfBirth ?? '').trim();
    if (!ISO_DATE_REGEX.test(dobStr)) {
      throw new BadRequestException('Ngày sinh không hợp lệ (YYYY-MM-DD)');
    }
    const dobDate = new Date(`${dobStr}T00:00:00.000Z`);
    if (Number.isNaN(dobDate.getTime()) || formatIsoDateUtc(dobDate) !== dobStr) {
      throw new BadRequestException('Ngày sinh không hợp lệ');
    }

    const age = calculateAgeInVnTimezone(dobStr, new Date());
    if (age < 12) {
      throw new BadRequestException('Học viên phải từ 12 tuổi trở lên');
    }

    let normalizedGuardianEmail: string | null = null;
    if (age >= 12 && age < 16) {
      const candidateGuardian = (dto.guardianEmail ?? '').trim().toLowerCase();
      if (!EMAIL_REGEX.test(candidateGuardian) || dto.guardianConsent !== true) {
        throw new BadRequestException('Vui lòng xác nhận đã có sự đồng ý của cha mẹ');
      }
      normalizedGuardianEmail = candidateGuardian;
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });
    if (existing) {
      throw new ConflictException('Email/Số điện thoại đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const createdUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            phone,
            fullName,
            passwordHash,
            roles: [Role.STUDENT],
            status: UserStatus.PENDING_CLASS,
          },
        });

        const studentProfile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            dateOfBirth: dobDate,
            guardianEmail: age < 16 ? normalizedGuardianEmail : null,
          },
        });

        if (age >= 12 && age < 16 && normalizedGuardianEmail) {
          await tx.guardianConsent.create({
            data: {
              studentProfileId: studentProfile.id,
              guardianEmail: normalizedGuardianEmail,
              consented: true,
              consentVersion: CONSENT_VERSION,
              consentTextSnapshot: CONSENT_TEXT_V1_0,
              ipAddress: meta?.ipAddress ? meta.ipAddress.slice(0, 64) : null,
              userAgent: meta?.userAgent ? meta.userAgent.slice(0, 500) : null,
            },
          });
        }

        return user;
      });

      const effectiveRole = getHighestRole(createdUser.roles);
      return {
        message: 'Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp',
        user: {
          id: createdUser.id,
          email: createdUser.email,
          fullName: createdUser.fullName,
          phone: createdUser.phone,
          roles: createdUser.roles,
          effectiveRole,
          status: createdUser.status,
          dateOfBirth: dobStr,
        },
      };
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email/Số điện thoại đã được sử dụng');
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    expiresIn: number;
    redirectTo: string;
    user: AuthUserDto;
  }> {
    const normalizedEmail = (dto.email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestException('Vui lòng đăng nhập bằng địa chỉ email hợp lệ');
    }
    const password = dto.password ?? '';

    const initialUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { studentProfile: true },
    });

    if (!initialUser) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // CPU-bound bcrypt runs outside withKeyLock and BEFORE INACTIVE status check
    // so wrong passwords on INACTIVE accounts return uniform 401 (anti-enumeration)
    const isPasswordValid = await bcrypt.compare(password, initialUser.passwordHash);

    return this.withKeyLock(`login:${normalizedEmail}`, async () => {
      if (!isPasswordValid) {
        return this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${initialUser.id} FOR UPDATE`;
          const freshUser =
            (await tx.user.findUnique({ where: { id: initialUser.id } })) ?? initialUser;
          const txNow = new Date();

          if (freshUser.lockedUntil && freshUser.lockedUntil.getTime() > txNow.getTime()) {
            throw new ForbiddenException(
              'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
            );
          }

          const isExpiredLock =
            freshUser.lockedUntil !== null &&
            freshUser.lockedUntil.getTime() <= txNow.getTime();
          const newAttempts = isExpiredLock ? 1 : freshUser.failedLoginAttempts + 1;
          const shouldLock = newAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
          const lockedUntil = shouldLock
            ? new Date(txNow.getTime() + LOCKOUT_DURATION_MS)
            : null;

          await tx.user.update({
            where: { id: initialUser.id },
            data: {
              failedLoginAttempts: newAttempts,
              lockedUntil,
            },
          });

          if (shouldLock) {
            throw new ForbiddenException(
              'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
            );
          }

          throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
        });
      }

      const freshUser =
        (await this.prisma.user.findUnique({
          where: { id: initialUser.id },
          include: { studentProfile: true },
        })) ?? initialUser;

      const now = new Date();
      if (freshUser.lockedUntil && freshUser.lockedUntil.getTime() > now.getTime()) {
        throw new ForbiddenException(
          'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
        );
      }

      if (freshUser.passwordHash !== initialUser.passwordHash) {
        throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
      }

      if (freshUser.status === UserStatus.INACTIVE) {
        throw new ForbiddenException('Tài khoản đã bị khóa, vui lòng liên hệ trung tâm');
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: freshUser.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: now,
          lastActivityAt: now,
        },
        include: { studentProfile: true },
      });

      const rememberMe = dto.rememberMe === true;
      const expiresInSeconds = rememberMe ? 7 * 24 * 60 * 60 : 3600;

      const payload: JwtPayload = {
        sub: updatedUser.id,
        email: updatedUser.email,
        tokenVersion: updatedUser.tokenVersion,
      };
      const secret = this.configService.get<string>('JWT_SECRET');
      const accessToken = await this.jwtService.signAsync(payload, {
        secret,
        expiresIn: rememberMe ? '7d' : 3600,
      });

      const effectiveRole = getHighestRole(updatedUser.roles);
      const userDto: AuthUserDto = {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        phone: updatedUser.phone,
        roles: updatedUser.roles,
        effectiveRole,
        status: updatedUser.status,
        ...(updatedUser.studentProfile?.dateOfBirth
          ? { dateOfBirth: formatIsoDateUtc(updatedUser.studentProfile.dateOfBirth) }
          : {}),
      };

      return {
        accessToken,
        expiresIn: expiresInSeconds,
        redirectTo: getDefaultRedirectByRole(effectiveRole),
        user: userDto,
      };
    });
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Tài khoản không tồn tại');
    }

    const effectiveRole = getHighestRole(user.roles);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles: user.roles,
      effectiveRole,
      status: user.status,
      ...(user.studentProfile?.dateOfBirth
        ? { dateOfBirth: formatIsoDateUtc(user.studentProfile.dateOfBirth) }
        : {}),
    };
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

  async forgotPassword(dto: ForgotPasswordDto): Promise<{
    message: string;
    cooldownSeconds: number;
    debugResetToken?: string;
  }> {
    const normalizedEmail = (dto.email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const emailHash = crypto.createHash('sha256').update(normalizedEmail).digest('hex');
    const nowMs = Date.now();

    // Prune expired cooldown entries (> 60s) to prevent unbounded memory growth
    for (const [hash, timestamp] of this.cooldownByEmailHash.entries()) {
      if (nowMs - timestamp >= FORGOT_PASSWORD_COOLDOWN_MS) {
        this.cooldownByEmailHash.delete(hash);
      }
    }

    const lastRequestedAt = this.cooldownByEmailHash.get(emailHash);

    if (
      lastRequestedAt !== undefined &&
      nowMs - lastRequestedAt < FORGOT_PASSWORD_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Vui lòng đợi trước khi gửi lại yêu cầu',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Always record cooldown timestamp regardless of whether user exists (SEC-06)
    this.cooldownByEmailHash.set(emailHash, nowMs);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let debugResetToken: string | undefined;
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(nowMs + RESET_TOKEN_TTL_MS);

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const currentEnv = this.configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
      if (currentEnv === 'test') {
        debugResetToken = rawToken;
      }
    }

    return {
      message: 'Nếu tài khoản tồn tại, hướng dẫn đã được gửi',
      cooldownSeconds: 60,
      ...(debugResetToken ? { debugResetToken } : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const rawToken = (dto.token ?? '').trim();
    if (!rawToken) {
      throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
    }

    const newPassword = dto.newPassword ?? '';
    if (newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (newPassword.length > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 ký tự');
    }

    if (dto.confirmPassword !== undefined && dto.confirmPassword !== newPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
      }

      const tokenRecord = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!tokenRecord) {
        throw new BadRequestException('Link đã hết hạn, vui lòng gửi lại');
      }

      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }

  clearCooldownsForTesting(): void {
    this.cooldownByEmailHash.clear();
  }
}
