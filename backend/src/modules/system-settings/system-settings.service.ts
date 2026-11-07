import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassStatus,
  EnrollmentStatus,
  Prisma,
  Role,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  sanitizeAuditMetadata,
  validateLogoImageDataUri,
} from '../../common/utils/audit-sanitize.util.js';
import { rethrowDuplicateContactConflict } from '../../common/utils/prisma-error.util.js';
import { getHighestRole } from '../../common/auth/role-hierarchy.util.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type {
  CreateSystemUserDto,
  ListAuditLogsQueryDto,
  ListSystemUsersQueryDto,
  UpdateSystemConfigDto,
  UpdateUserRolesStatusDto,
} from './dto/system-settings.dto.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9}$/;

export const SETTING_KEY_CENTER_NAME = 'CENTER_NAME';
export const SETTING_KEY_CENTER_LOGO_URL = 'CENTER_LOGO_URL';
export const DEFAULT_CENTER_NAME = 'Trung Tâm TD Hán Ngữ';

export interface SystemUserItemDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  effectiveRole: Role;
  status: UserStatus;
  createdAt: string;
}

export interface SystemConfigResponseDto {
  centerName: string;
  centerLogoUrl: string | null;
  centerLogoBase64: string | null;
}

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSystemUserDto(user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    roles: Role[];
    status: UserStatus;
    createdAt: Date;
  }): SystemUserItemDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      effectiveRole: getHighestRole(user.roles),
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async listSystemUsers(query?: ListSystemUsersQueryDto): Promise<{
    items: SystemUserItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;
    const search = query?.search?.trim();

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => this.toSystemUserDto(u)),
      total,
      page,
      limit,
    };
  }

  async createSystemUser(
    actor: AuthenticatedUser,
    dto: CreateSystemUserDto,
  ): Promise<SystemUserItemDto> {
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
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
    }

    const initialPassword = dto.initialPassword ?? '';
    if (initialPassword.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (initialPassword.length > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 ký tự');
    }

    if (!Array.isArray(dto.roles) || dto.roles.length === 0) {
      throw new BadRequestException('Phải chọn ít nhất một vai trò');
    }

    const uniqueRoles = Array.from(new Set(dto.roles));
    if (uniqueRoles.length === 1 && uniqueRoles[0] === Role.STUDENT) {
      throw new BadRequestException(
        'Tài khoản Học viên phải được tạo qua luồng Đăng ký học viên để kiểm tra độ tuổi và đồng ý phụ huynh',
      );
    }

    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });
    if (duplicate) {
      throw new ConflictException('Email/Số điện thoại đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName,
            email,
            phone,
            passwordHash,
            roles: uniqueRoles,
            status: UserStatus.ACTIVE,
          },
        });

        if (uniqueRoles.includes(Role.TEACHER) && tx.teacherProfile?.upsert) {
          await tx.teacherProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: {
              userId: user.id,
              activeClassesCount: 0,
            },
          });
        }

        await tx.systemAuditLog.create({
          data: {
            actorId: actor.id,
            actingRole: actor.effectiveRole,
            action: 'CREATE_SYSTEM_USER',
            targetType: 'User',
            targetId: user.id,
            metadata: sanitizeAuditMetadata({
              fullName,
              email,
              phone,
              roles: uniqueRoles,
              initialPassword,
            }) as Prisma.InputJsonValue,
          },
        });

        return user;
      });

      return this.toSystemUserDto(created);
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }

  async updateUserRolesAndStatus(
    actor: AuthenticatedUser,
    targetUserId: string,
    dto: UpdateUserRolesStatusDto,
  ): Promise<SystemUserItemDto> {
    if (
      targetUserId === actor.id &&
      ((dto.status !== undefined && dto.status !== UserStatus.ACTIVE) ||
        (dto.roles !== undefined && !dto.roles.includes(Role.SUPERADMIN)))
    ) {
      throw new BadRequestException(
        'Không thể tự vô hiệu hóa chính mình hoặc gỡ vai trò Superadmin cuối cùng',
      );
    }

    if (dto.roles !== undefined && dto.roles.length === 0) {
      throw new BadRequestException('Tài khoản phải có ít nhất một vai trò');
    }

    return this.prisma.$transaction(async (tx) => {
      // SEC-07 & Deadlock-free lock order: lock target user + all active Superadmins
      // in a single deterministic ORDER BY id ASC FOR UPDATE query.
      await tx.$queryRaw`
        SELECT id FROM "users"
        WHERE id = ${targetUserId} OR ('SUPERADMIN' = ANY("roles") AND "status" = 'ACTIVE')
        ORDER BY id ASC
        FOR UPDATE
      `;

      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        include: {
          studentProfile: true,
          teacherProfile: true,
        },
      });

      if (!targetUser) {
        throw new NotFoundException('Không tìm thấy tài khoản');
      }

      const nextRoles =
        dto.roles !== undefined
          ? Array.from(new Set(dto.roles))
          : targetUser.roles;
      const nextStatus = dto.status ?? targetUser.status;

      if (!nextRoles.includes(Role.STUDENT) && nextStatus === UserStatus.PENDING_CLASS) {
        throw new BadRequestException(
          'Trạng thái Chờ xếp lớp chỉ áp dụng cho tài khoản Học viên',
        );
      }

      // FUNC-008: Forbid bypassing initial enrollment or reactivating a dropped pure student without an active/completed enrollment
      const willBePureStudent =
        nextRoles.length === 1 && nextRoles[0] === Role.STUDENT;
      if (willBePureStudent) {
        const validEnrollmentCount = tx.enrollment?.count
          ? await tx.enrollment.count({
              where: {
                studentId: targetUserId,
                status: {
                  in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
                },
              },
            })
          : null;

        const hasActiveOrCompletedEnrollment =
          validEnrollmentCount !== null
            ? validEnrollmentCount > 0 ||
              Boolean(targetUser.studentProfile?.currentClassId)
            : Boolean(
                targetUser.studentProfile?.enrolledAt ||
                  targetUser.studentProfile?.currentClassId ||
                  targetUser.studentProfile?.assignedClass,
              );

        const hasEverBeenEnrolled =
          (validEnrollmentCount !== null && validEnrollmentCount > 0) ||
          Boolean(
            targetUser.studentProfile?.enrolledAt ||
              targetUser.studentProfile?.currentClassId ||
              targetUser.studentProfile?.assignedClass,
          );

        if (!hasActiveOrCompletedEnrollment && nextStatus === UserStatus.ACTIVE) {
          throw new BadRequestException(
            'Tài khoản chờ xếp lớp chỉ được kích hoạt thông qua nghiệp vụ Xếp lớp ban đầu',
          );
        }
        if (hasEverBeenEnrolled && nextStatus === UserStatus.PENDING_CLASS) {
          throw new BadRequestException(
            'Không thể chuyển học viên đã xếp lớp về lại trạng thái Chờ xếp lớp',
          );
        }
      }

      // FUNC-006: Prevent deactivating or stripping TEACHER role when teacher still leads active/upcoming classes
      const isDroppingActiveTeacher =
        targetUser.roles.includes(Role.TEACHER) &&
        (nextStatus === UserStatus.INACTIVE || !nextRoles.includes(Role.TEACHER));
      if (isDroppingActiveTeacher) {
        const dbActiveClasses = tx.class?.count
          ? await tx.class.count({
              where: {
                teacherId: targetUserId,
                status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
              },
            })
          : 0;
        const effectiveActiveClasses = Math.max(
          targetUser.teacherProfile?.activeClassesCount ?? 0,
          dbActiveClasses,
        );
        if (effectiveActiveClasses > 0) {
          throw new ConflictException(
            `Giáo viên đang phụ trách ${effectiveActiveClasses} lớp. Vui lòng phân công giáo viên khác`,
          );
        }
      }

      const wasActiveSuperadmin =
        targetUser.roles.includes(Role.SUPERADMIN) &&
        targetUser.status === UserStatus.ACTIVE;
      const willBeActiveSuperadmin =
        nextRoles.includes(Role.SUPERADMIN) &&
        nextStatus === UserStatus.ACTIVE;

      if (wasActiveSuperadmin && !willBeActiveSuperadmin) {
        const otherActiveSuperadmins = await tx.user.count({
          where: {
            id: { not: targetUserId },
            roles: { has: Role.SUPERADMIN },
            status: UserStatus.ACTIVE,
          },
        });

        if (otherActiveSuperadmins < 1) {
          throw new BadRequestException(
            'Không thể tự vô hiệu hóa chính mình hoặc gỡ vai trò Superadmin cuối cùng',
          );
        }
      }

      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: {
          roles: nextRoles,
          status: nextStatus,
          tokenVersion: { increment: 1 },
        },
      });

      if (nextRoles.includes(Role.TEACHER) && tx.teacherProfile?.upsert) {
        await tx.teacherProfile.upsert({
          where: { userId: targetUserId },
          update: {},
          create: {
            userId: targetUserId,
            activeClassesCount: 0,
          },
        });
      }

      await tx.systemAuditLog.create({
        data: {
          actorId: actor.id,
          actingRole: actor.effectiveRole,
          action: 'UPDATE_USER_ROLES_STATUS',
          targetType: 'User',
          targetId: targetUserId,
          metadata: sanitizeAuditMetadata({
            previousRoles: targetUser.roles,
            newRoles: nextRoles,
            previousStatus: targetUser.status,
            newStatus: nextStatus,
          }) as Prisma.InputJsonValue,
        },
      });

      return this.toSystemUserDto(updated);
    });
  }

  async getSystemConfig(): Promise<SystemConfigResponseDto> {
    const rows = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [SETTING_KEY_CENTER_NAME, SETTING_KEY_CENTER_LOGO_URL],
        },
      },
    });

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.key, row.value);
    }

    const centerName = map.get(SETTING_KEY_CENTER_NAME) || DEFAULT_CENTER_NAME;
    const logoValue = map.get(SETTING_KEY_CENTER_LOGO_URL) || null;

    // Cleanup #15: Strictly return ONLY centerName and logo fields (never timezone)
    return {
      centerName,
      centerLogoUrl: logoValue,
      centerLogoBase64: logoValue,
    };
  }

  async updateSystemConfig(
    actor: AuthenticatedUser,
    dto: UpdateSystemConfigDto & Record<string, unknown>,
  ): Promise<SystemConfigResponseDto> {
    if ('timezone' in dto && dto.timezone !== undefined) {
      throw new BadRequestException(
        'Trường múi giờ đã bị loại bỏ khỏi cấu hình hệ thống',
      );
    }

    const centerName = (dto.centerName ?? '').trim();
    if (!centerName) {
      throw new BadRequestException('Tên trung tâm không được để trống');
    }

    const rawLogo =
      dto.centerLogoUrl !== undefined
        ? dto.centerLogoUrl
        : dto.centerLogoBase64;
    const trimmedLogo = rawLogo ? rawLogo.trim() : '';

    // P1-2 / SEC-09: Only allow empty/null (clear logo) or valid PNG/JPEG base64 data URI verified by Magic Bytes
    if (trimmedLogo) {
      const validation = validateLogoImageDataUri(trimmedLogo);
      if (!validation.valid) {
        throw new BadRequestException(
          validation.reason ??
            'Logo chỉ chấp nhận định dạng ảnh .png hoặc .jpg hợp lệ',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: SETTING_KEY_CENTER_NAME },
        update: { value: centerName },
        create: {
          key: SETTING_KEY_CENTER_NAME,
          value: centerName,
          description: 'Tên hiển thị trung tâm trên toàn hệ thống',
        },
      });

      if (rawLogo !== undefined) {
        await tx.systemSetting.upsert({
          where: { key: SETTING_KEY_CENTER_LOGO_URL },
          update: { value: trimmedLogo },
          create: {
            key: SETTING_KEY_CENTER_LOGO_URL,
            value: trimmedLogo,
            description: 'Logo trung tâm (PNG/JPG Data URI hoặc URL)',
          },
        });
      }

      await tx.systemAuditLog.create({
        data: {
          actorId: actor.id,
          actingRole: actor.effectiveRole,
          action: 'UPDATE_SYSTEM_CONFIG',
          targetType: 'SystemSetting',
          targetId: SETTING_KEY_CENTER_NAME,
          metadata: sanitizeAuditMetadata({
            centerName,
            hasLogo: Boolean(trimmedLogo),
          }) as Prisma.InputJsonValue,
        },
      });
    });

    return this.getSystemConfig();
  }

  async listAuditLogs(query: ListAuditLogsQueryDto): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.systemAuditLog.findMany({
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.systemAuditLog.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }
}
