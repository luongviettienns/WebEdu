import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import {
  RetryWithSuperadminLocksError,
  assertAnotherActiveSuperadminRemains,
  assertFreshActiveSuperadminActorInTx,
  assertSuperadminNotSelfDeactivating,
  lockTargetUser,
  lockUserAndActiveSuperadmins,
  runWithSuperadminLockRetry,
  type LockedUserRow,
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
 * Role/status mutation for any account. Enforces maintaining at least one
 * ACTIVE Superadmin, preventing activation bypass of class placement, and
 * preventing stripping a teacher who still leads classes. Every change
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

    return runWithSuperadminLockRetry(this.prisma, (tx, forceSuperadminLocks) =>
      this.executeRoleStatusUpdateTx(
        tx,
        actor,
        targetUserId,
        dto,
        forceSuperadminLocks,
      ),
    );
  }

  private async executeRoleStatusUpdateTx(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    targetUserId: string,
    dto: UpdateUserRolesStatusDto,
    forceSuperadminLocks: boolean,
  ): Promise<SystemUserItemDto> {
    // Determine locking strategy without acquiring out-of-order locks
    const preliminary = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { roles: true, status: true },
    });
    if (!preliminary) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    // If retry forced or target/requested roles touch SUPERADMIN, lock all active superadmins in canonical ORDER BY id ASC.
    const touchesSuperadmin =
      forceSuperadminLocks ||
      preliminary.roles.includes(Role.SUPERADMIN) ||
      (dto.roles !== undefined && dto.roles.includes(Role.SUPERADMIN));

    let lockedSuperadmins: LockedUserRow[] | undefined;
    if (touchesSuperadmin) {
      lockedSuperadmins = await lockUserAndActiveSuperadmins(tx, targetUserId);
    } else {
      // Normal user role/status change: lock only target row to prevent contention
      await lockTargetUser(tx, targetUserId);
    }

    await assertFreshActiveSuperadminActorInTx(
      tx,
      actor,
      'Chỉ Quản trị tối cao (Superadmin) mới có quyền phân quyền hoặc đổi trạng thái người dùng',
    );

    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
      include: { studentProfile: true, teacherProfile: true },
    });
    if (!targetUser) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    // Concurrent transaction promoted target to SUPERADMIN after preliminary read:
    // abort this tx rather than upgrading locks out of ORDER BY id ASC order (40P01 hazard).
    if (!lockedSuperadmins && targetUser.roles.includes(Role.SUPERADMIN)) {
      throw new RetryWithSuperadminLocksError();
    }

      const nextRoles =
        dto.roles !== undefined
          ? Array.from(new Set(dto.roles))
          : targetUser.roles;
      const nextStatus = dto.status ?? targetUser.status;
      assertSuperadminNotSelfDeactivating(
        actor,
        { id: targetUserId, roles: targetUser.roles },
        nextStatus,
      );

      // F3: Prevent stale form from granting ADMIN/SUPERADMIN while deactivating or to inactive user
      const isGrantingAdminPrivilege =
        dto.roles !== undefined &&
        ((dto.roles.includes(Role.ADMIN) &&
          !targetUser.roles.includes(Role.ADMIN)) ||
          (dto.roles.includes(Role.SUPERADMIN) &&
            !targetUser.roles.includes(Role.SUPERADMIN)));

      if (nextStatus === UserStatus.INACTIVE && isGrantingAdminPrivilege) {
        throw new BadRequestException(
          'Không thể cấp quyền quản trị (ADMIN/SUPERADMIN) cho tài khoản bị vô hiệu hóa',
        );
      }

      // F4: Prevent removing STUDENT role if user has an active class enrollment
      if (
        targetUser.roles.includes(Role.STUDENT) &&
        !nextRoles.includes(Role.STUDENT)
      ) {
        const activeEnrollmentCount = await tx.enrollment.count({
          where: {
            studentId: targetUserId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
        if (activeEnrollmentCount > 0) {
          throw new BadRequestException(
            'Không thể gỡ vai trò Học viên khi học viên đang có lớp học đang hoạt động',
          );
        }
      }

      if (
        !nextRoles.includes(Role.STUDENT) &&
        nextStatus === UserStatus.PENDING_CLASS
      ) {
        throw new BadRequestException(
          'Trạng thái Chờ xếp lớp chỉ áp dụng cho tài khoản Học viên',
        );
      }

      // Forbid bypassing initial enrollment or reactivating a dropped
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

      // Cannot deactivate or strip TEACHER while still leading active/upcoming classes
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

    const wasActiveSuperadmin =
      targetUser.roles.includes(Role.SUPERADMIN) &&
      targetUser.status === UserStatus.ACTIVE;
    const willBeActiveSuperadmin =
      nextRoles.includes(Role.SUPERADMIN) && nextStatus === UserStatus.ACTIVE;
    if (wasActiveSuperadmin && !willBeActiveSuperadmin) {
      if (!lockedSuperadmins) {
        throw new RetryWithSuperadminLocksError();
      }
      assertAnotherActiveSuperadminRemains(targetUserId, lockedSuperadmins);
    }

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: {
        roles: nextRoles,
        status: nextStatus,
        tokenVersion: { increment: 1 },
      },
    });

    if (nextRoles.includes(Role.TEACHER)) {
      await tx.teacherProfile.upsert({
        where: { userId: targetUserId },
        update: {},
        create: { userId: targetUserId, activeClassesCount: 0 },
      });
    }

    if (nextRoles.includes(Role.STUDENT)) {
      await tx.studentProfile.upsert({
        where: { userId: targetUserId },
        update: {},
        create: {
          userId: targetUserId,
          dateOfBirth: new Date('2000-01-01'),
        },
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
  }
}
