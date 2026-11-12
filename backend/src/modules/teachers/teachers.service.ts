import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassStatus, Prisma, Role, UserStatus } from '@prisma/client';
import { hashPassword } from '../../common/auth/password-hash.util.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../common/audit/audit-log.util.js';
import { rethrowDuplicateContactConflict } from '../../common/utils/prisma-error.util.js';
import {
  assertValidContactFields,
  assertValidInitialPassword,
  normalizeEmail,
} from '../../common/utils/contact-validation.util.js';
import { resolvePagination } from '../../common/utils/pagination.util.js';
import { buildUserSearchFilter } from '../../common/utils/user-search.util.js';
import {
  assertActorMayModifyAccount,
  assertAnotherActiveSuperadminRemains,
  assertSuperadminNotSelfDeactivating,
  isLeavingActiveSuperadmin,
  lockTargetUser,
  lockUserAndActiveSuperadmins,
  type LockedUserRow,
} from '../../common/auth/superadmin-protection.policy.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type {
  CreateTeacherDto,
  ListTeachersQueryDto,
  UpdateTeacherDto,
} from './dto/teachers.dto.js';
import { toTeacherItemDto, type TeacherItemDto } from './mappers/teacher.mapper.js';
import {
  assertNoActiveClassesLed,
  countEffectiveActiveClasses,
} from '../../common/policies/teacher-invariants.policy.js';

/** Teacher account management. */
@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeachers(query: ListTeachersQueryDto): Promise<{
    items: TeacherItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.UserWhereInput = {
      roles: { has: Role.TEACHER },
      ...(query.status ? { status: query.status } : {}),
      ...buildUserSearchFilter(query.search),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          teacherProfile: true,
          _count: {
            select: {
              taughtClasses: {
                where: {
                  status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
                },
              },
            },
          },
        },
        orderBy: { fullName: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: users.map(toTeacherItemDto), total, page, limit };
  }

  async createTeacher(
    actor: AuthenticatedUser,
    dto: CreateTeacherDto,
  ): Promise<TeacherItemDto> {
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

    const duplicate = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (duplicate) {
      throw new ConflictException('Email/Số điện thoại đã được sử dụng');
    }

    const passwordHash = await hashPassword(initialPassword);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName,
            email,
            phone,
            passwordHash,
            roles: [Role.TEACHER],
            status: UserStatus.ACTIVE,
          },
        });

        const teacherProfile = await tx.teacherProfile.create({
          data: {
            userId: user.id,
            notes: dto.notes?.trim() || null,
            activeClassesCount: 0,
          },
        });

        await writeAuditLog(tx, actor, {
          action: 'CREATE_TEACHER',
          targetType: 'User',
          targetId: user.id,
          metadata: { fullName, email, phone, hasInitialCredentials: true },
        });

        return { ...user, teacherProfile };
      });

      return toTeacherItemDto(created);
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }

  async updateTeacher(
    actor: AuthenticatedUser,
    teacherId: string,
    dto: UpdateTeacherDto,
  ): Promise<TeacherItemDto> {
    if (
      dto.status !== undefined &&
      dto.status !== UserStatus.ACTIVE &&
      dto.status !== UserStatus.INACTIVE
    ) {
      throw new BadRequestException(
        'Trạng thái giáo viên chỉ chấp nhận ACTIVE hoặc INACTIVE',
      );
    }
    assertValidContactFields(dto);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Determine locking strategy without acquiring out-of-order locks
        const preliminary = await tx.user.findUnique({
          where: { id: teacherId },
          select: { roles: true, status: true },
        });
        if (!preliminary || !preliminary.roles.includes(Role.TEACHER)) {
          throw new NotFoundException('Không tìm thấy giáo viên');
        }

        // Check actor permissions before locking or evaluating pool state
        assertActorMayModifyAccount(actor, preliminary.roles);

        const nextStatus = dto.status ?? preliminary.status;

        // Superadmin may not self-deactivate
        assertSuperadminNotSelfDeactivating(
          actor,
          { id: teacherId, roles: preliminary.roles },
          nextStatus,
        );

        const leavingSuperadmin = isLeavingActiveSuperadmin(
          preliminary.roles,
          nextStatus,
        );

        let lockedSuperadmins: LockedUserRow[] | undefined;
        if (leavingSuperadmin) {
          // Lock all active superadmins in canonical ORDER BY id ASC to avoid 40P01 deadlocks
          lockedSuperadmins = await lockUserAndActiveSuperadmins(tx, teacherId);
          assertAnotherActiveSuperadminRemains(teacherId, lockedSuperadmins);
        } else {
          // Normal teacher update: lock only the target user row to avoid global contention
          await lockTargetUser(tx, teacherId);
        }

        const targetUser = await tx.user.findUnique({
          where: { id: teacherId },
          include: { teacherProfile: true },
        });
        if (!targetUser || !targetUser.roles.includes(Role.TEACHER)) {
          throw new NotFoundException('Không tìm thấy giáo viên');
        }

        // Re-check actor permissions on freshly locked target roles to eliminate race window (F1)
        assertActorMayModifyAccount(actor, targetUser.roles);
        assertSuperadminNotSelfDeactivating(
          actor,
          { id: teacherId, roles: targetUser.roles },
          nextStatus,
        );
        if (
          isLeavingActiveSuperadmin(targetUser.roles, nextStatus) &&
          !leavingSuperadmin
        ) {
          lockedSuperadmins = await lockUserAndActiveSuperadmins(tx, teacherId);
          assertAnotherActiveSuperadminRemains(teacherId, lockedSuperadmins);
        }

        const nextFullName =
          dto.fullName !== undefined ? dto.fullName.trim() : targetUser.fullName;
        const nextEmail =
          dto.email !== undefined ? normalizeEmail(dto.email) : targetUser.email;
        const nextPhone =
          dto.phone !== undefined ? dto.phone.trim() : targetUser.phone;

        if (nextEmail !== targetUser.email || nextPhone !== targetUser.phone) {
          const duplicate = await tx.user.findFirst({
            where: {
              id: { not: teacherId },
              OR: [{ email: nextEmail }, { phone: nextPhone }],
            },
          });
          if (duplicate) {
            throw new ConflictException('Email/Số điện thoại đã được sử dụng');
          }
        }

        const { effective: effectiveActiveClassesCount, fromDb: dbActiveClasses } =
          await countEffectiveActiveClasses(
            tx,
            teacherId,
            targetUser.teacherProfile?.activeClassesCount ?? 0,
          );
        if (nextStatus === UserStatus.INACTIVE) {
          assertNoActiveClassesLed(effectiveActiveClassesCount);
        }


        const emailChanged = nextEmail !== targetUser.email;
        const isDeactivating =
          nextStatus === UserStatus.INACTIVE &&
          targetUser.status !== UserStatus.INACTIVE;
        const shouldRevokeTokens = isDeactivating || emailChanged;

        const userUpdateData: Prisma.UserUpdateInput = {
          ...(dto.fullName !== undefined ? { fullName: nextFullName } : {}),
          ...(dto.email !== undefined ? { email: nextEmail } : {}),
          ...(dto.phone !== undefined ? { phone: nextPhone } : {}),
          ...(dto.status !== undefined ? { status: nextStatus } : {}),
          ...(shouldRevokeTokens ? { tokenVersion: { increment: 1 } } : {}),
        };

        const updatedUser =
          Object.keys(userUpdateData).length > 0
            ? await tx.user.update({
                where: { id: teacherId },
                data: userUpdateData,
                include: { teacherProfile: true },
              })
            : targetUser;

        let profile = updatedUser.teacherProfile ?? targetUser.teacherProfile;
        if (dto.notes !== undefined) {
          profile = await tx.teacherProfile.upsert({
            where: { userId: teacherId },
            update: { notes: dto.notes.trim() || null },
            create: {
              userId: teacherId,
              notes: dto.notes.trim() || null,
              activeClassesCount: 0,
            },
          });
        }

        await writeAuditLog(tx, actor, {
          action: 'UPDATE_TEACHER',
          targetType: 'User',
          targetId: teacherId,
          metadata: {
            previousStatus: targetUser.status,
            newStatus: nextStatus,
            fullName: nextFullName,
            email: nextEmail,
            phone: nextPhone,
          },
        });

        return {
          ...updatedUser,
          teacherProfile: profile,
          _count: { taughtClasses: dbActiveClasses },
        };
      });

      return toTeacherItemDto(updated);
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }
  }
}
