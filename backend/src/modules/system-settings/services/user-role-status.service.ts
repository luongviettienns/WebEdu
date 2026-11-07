import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import {
  lockTargetUser,
  lockUserAndActiveSuperadmins,
} from '../../../common/auth/superadmin-protection.policy.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { loadEnrollmentFacts } from '../../../common/policies/enrollment-invariants.policy.js';
import {
  assertNoActiveClassesLed,
  countEffectiveActiveClasses,
} from '../../../common/policies/teacher-invariants.policy.js';
import type { UpdateUserRolesStatusDto } from '../dto/system-settings.dto.js';
import {
  toSystemUserDto,
  type SystemUserItemDto,
} from '../mappers/system-user.mapper.js';

const LAST_SUPERADMIN_MESSAGE =
  'Không thể tự vô hiệu hóa chính mình hoặc gỡ vai trò Superadmin cuối cùng';

/**
 * Role/status mutation for any account (FUNC-013). Enforces SEC-07 (always one
 * ACTIVE Superadmin), FUNC-008 (no activation bypass of class placement) and
 * FUNC-006 (no stripping a teacher who still leads classes). Every change
 * revokes sessions via a tokenVersion bump.
 */
@Injectable()
export class UserRoleStatusService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new BadRequestException(LAST_SUPERADMIN_MESSAGE);
    }

    if (dto.roles !== undefined && dto.roles.length === 0) {
      throw new BadRequestException('Tài khoản phải có ít nhất một vai trò');
    }

    return this.prisma.$transaction(async (tx) => {
      // Determine locking strategy without acquiring out-of-order locks
      const preliminary = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { roles: true, status: true },
      });
      if (!preliminary) {
        throw new NotFoundException('Không tìm thấy tài khoản');
      }

      // If target or requested roles touch SUPERADMIN, lock all active superadmins in canonical ORDER BY id ASC (SEC-07).
      const touchesSuperadmin =
        preliminary.roles.includes(Role.SUPERADMIN) ||
        (dto.roles !== undefined && dto.roles.includes(Role.SUPERADMIN));

      if (touchesSuperadmin) {
        await lockUserAndActiveSuperadmins(tx, targetUserId);
      } else {
        // Normal user role/status change: lock only target row to prevent contention (FIX-05)
        await lockTargetUser(tx, targetUserId);
      }

      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
        include: { studentProfile: true, teacherProfile: true },
      });
      if (!targetUser) {
        throw new NotFoundException('Không tìm thấy tài khoản');
      }

      const nextRoles =
        dto.roles !== undefined
          ? Array.from(new Set(dto.roles))
          : targetUser.roles;
      const nextStatus = dto.status ?? targetUser.status;

      if (
        !nextRoles.includes(Role.STUDENT) &&
        nextStatus === UserStatus.PENDING_CLASS
      ) {
        throw new BadRequestException(
          'Trạng thái Chờ xếp lớp chỉ áp dụng cho tài khoản Học viên',
        );
      }

      // FUNC-008: forbid bypassing initial enrollment or reactivating a dropped
      // pure student without an active/completed enrollment
      const willBePureStudent =
        nextRoles.length === 1 && nextRoles[0] === Role.STUDENT;
      if (willBePureStudent) {
        const { hasActiveOrCompletedEnrollment, hasEverBeenEnrolled } =
          await loadEnrollmentFacts(tx, targetUserId, targetUser.studentProfile);

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

      // FUNC-006: cannot deactivate or strip TEACHER while still leading active/upcoming classes
      const isDroppingActiveTeacher =
        targetUser.roles.includes(Role.TEACHER) &&
        (nextStatus === UserStatus.INACTIVE ||
          !nextRoles.includes(Role.TEACHER));
      if (isDroppingActiveTeacher) {
        const { effective } = await countEffectiveActiveClasses(
          tx,
          targetUserId,
          targetUser.teacherProfile?.activeClassesCount ?? 0,
        );
        assertNoActiveClassesLed(effective);
      }

      await this.assertLastActiveSuperadminSurvives(tx, targetUser, nextRoles, nextStatus);

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
          create: { userId: targetUserId, activeClassesCount: 0 },
        });
      }

      await writeAuditLog(tx, actor, {
        action: 'UPDATE_USER_ROLES_STATUS',
        targetType: 'User',
        targetId: targetUserId,
        metadata: {
          previousRoles: targetUser.roles,
          newRoles: nextRoles,
          previousStatus: targetUser.status,
          newStatus: nextStatus,
        },
      });

      return toSystemUserDto(updated);
    });
  }

  /** SEC-07: demoting/deactivating an active Superadmin requires another active one. */
  private async assertLastActiveSuperadminSurvives(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    targetUser: { id: string; roles: Role[]; status: UserStatus },
    nextRoles: Role[],
    nextStatus: UserStatus,
  ): Promise<void> {
    const wasActiveSuperadmin =
      targetUser.roles.includes(Role.SUPERADMIN) &&
      targetUser.status === UserStatus.ACTIVE;
    const willBeActiveSuperadmin =
      nextRoles.includes(Role.SUPERADMIN) && nextStatus === UserStatus.ACTIVE;

    if (!wasActiveSuperadmin || willBeActiveSuperadmin) {
      return;
    }

    const otherActiveSuperadmins = await tx.user.count({
      where: {
        id: { not: targetUser.id },
        roles: { has: Role.SUPERADMIN },
        status: UserStatus.ACTIVE,
      },
    });
    if (otherActiveSuperadmins < 1) {
      throw new BadRequestException(LAST_SUPERADMIN_MESSAGE);
    }
  }
}
