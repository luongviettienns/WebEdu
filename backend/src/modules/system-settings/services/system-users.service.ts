import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { rethrowDuplicateContactConflict } from '../../../common/utils/prisma-error.util.js';
import {
  assertValidContactFields,
  assertValidInitialPassword,
  normalizeEmail,
} from '../../../common/utils/contact-validation.util.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
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
    const where: Prisma.UserWhereInput = buildUserSearchFilter(query?.search);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: users.map(toSystemUserDto), total, page, limit };
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
    if (uniqueRoles.length === 1 && uniqueRoles[0] === Role.STUDENT) {
      throw new BadRequestException(
        'Tài khoản Học viên phải được tạo qua luồng Đăng ký học viên để kiểm tra độ tuổi và đồng ý phụ huynh',
      );
    }

    const duplicate = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
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
            create: { userId: user.id, activeClassesCount: 0 },
          });
        }

        if (uniqueRoles.includes(Role.STUDENT) && tx.studentProfile?.upsert) {
          await tx.studentProfile.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id, dateOfBirth: new Date('2000-01-01') },
          });
        }

        await writeAuditLog(tx, actor, {
          action: 'CREATE_SYSTEM_USER',
          targetType: 'User',
          targetId: user.id,
          metadata: { fullName, email, phone, roles: uniqueRoles, hasInitialCredentials: true },
        });

        return user;
      });

      return toSystemUserDto(created);
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }
}
