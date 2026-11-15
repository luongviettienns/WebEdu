import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { hashPassword } from '../../../common/auth/password-hash.util.js';
import {
  assertActorMayModifyAccount,
  assertAnotherActiveSuperadminRemains,
  assertFreshActiveSuperadminActorInTx,
  lockUserAndActiveSuperadmins,
} from '../../../common/auth/superadmin-protection.policy.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { rethrowDuplicateContactConflict } from '../../../common/utils/prisma-error.util.js';
import {
  assertValidContactFields,
  assertValidInitialPassword,
  normalizeEmail,
} from '../../../common/utils/contact-validation.util.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import { requireStudentRoleDate } from './student-role-date.util.js';
import { buildUserSearchFilter } from '../../../common/utils/user-search.util.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type {
  CreateSystemUserDto,
  ListSystemUsersQueryDto,
} from '../dto/system-settings.dto.js';
import {
  toSystemUserDto,
  type SystemUserItemDto,
} from '../mappers/system-user.mapper.js';

/** Superadmin-facing account directory: list and create staff accounts. */
@Injectable()
export class SystemUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listSystemUsers(query?: ListSystemUsersQueryDto): Promise<{
    items: SystemUserItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, skip } = resolvePagination(query, 50);
    const conditions: Prisma.UserWhereInput[] = [];
    const searchFilter = buildUserSearchFilter(query?.search);
    if (searchFilter.OR) {
      conditions.push(searchFilter);
    }
    if (query?.role) {
      conditions.push({ roles: { has: query.role } });
    }
    if (query?.status) {
      conditions.push({ status: query.status });
    }
    const where: Prisma.UserWhereInput =
      conditions.length > 0 ? { AND: conditions } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { studentProfile: { select: { userId: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: users.map((user) => toSystemUserDto(user)), total, page, limit };
  }

  async createSystemUser(
    actor: AuthenticatedUser,
    dto: CreateSystemUserDto,
  ): Promise<SystemUserItemDto> {
    assertValidContactFields({
      fullName: dto.fullName ?? '',
      email: dto.email ?? '',
      phone: dto.phone ?? '',
    });
    const fullName = (dto.fullName ?? '').trim();
    const email = normalizeEmail(dto.email ?? '');
    const phone = (dto.phone ?? '').trim();

    const initialPassword = dto.initialPassword ?? '';
    assertValidInitialPassword(initialPassword);

    if (!Array.isArray(dto.roles) || dto.roles.length === 0) {
      throw new BadRequestException('Phải chọn ít nhất một vai trò');
    }

    const uniqueRoles = Array.from(new Set(dto.roles));
    assertActorMayModifyAccount(actor, uniqueRoles);
    if (uniqueRoles.length === 1 && uniqueRoles[0] === Role.STUDENT) {
      throw new BadRequestException(
        'Tài khoản Học viên phải được tạo qua luồng Đăng ký học viên để kiểm tra độ tuổi và đồng ý phụ huynh',
      );
    }

    const dateOfBirth = uniqueRoles.includes(Role.STUDENT) ? requireStudentRoleDate(dto.dateOfBirth) : null;
    const duplicate = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (duplicate) {
      throw new ConflictException('Email/Số điện thoại đã được sử dụng');
    }

    const passwordHash = await hashPassword(initialPassword);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const lockedSuperadmins = await lockUserAndActiveSuperadmins(tx, actor.id);
        await assertFreshActiveSuperadminActorInTx(
          tx,
          actor,
          'Chỉ Quản trị tối cao (Superadmin) mới có quyền phân quyền hoặc tạo tài khoản hệ thống',
        );
        assertAnotherActiveSuperadminRemains('__create_system_user__', lockedSuperadmins);

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

        if (uniqueRoles.includes(Role.TEACHER)) {
          await tx.teacherProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id, activeClassesCount: 0 },
          });
        }

        if (dateOfBirth) {
          await tx.studentProfile.create({ data: { userId: user.id, dateOfBirth } });
        }

        await writeAuditLog(tx, actor, {
          action: 'CREATE_SYSTEM_USER',
          targetType: 'User',
          targetId: user.id,
          metadata: { fullName, email, phone, roles: uniqueRoles, hasInitialCredentials: true },
        });

        return user;
      });

      return toSystemUserDto(created, dateOfBirth !== null);
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }
}
