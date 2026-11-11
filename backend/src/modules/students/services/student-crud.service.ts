import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { rethrowDuplicateContactConflict } from '../../../common/utils/prisma-error.util.js';
import {
  assertValidContactFields,
  normalizeEmail,
} from '../../../common/utils/contact-validation.util.js';
import {
  calculateAgeInVnTimezone,
  formatIsoDateUtc,
} from '../../../common/utils/timezone.util.js';
import {
  assertActorMayModifyAccount,
  assertAnotherActiveSuperadminRemains,
  assertSuperadminNotSelfDeactivating,
  isLeavingActiveSuperadmin,
  lockTargetUser,
  lockUserAndActiveSuperadmins,
  type LockedUserRow,
} from '../../../common/auth/superadmin-protection.policy.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { UpdateStudentDto } from '../dto/students.dto.js';
import { loadEnrollmentFacts } from '../../../common/policies/enrollment-invariants.policy.js';
import {
  assertNoActiveClassesLed,
  countEffectiveActiveClasses,
} from '../../../common/policies/teacher-invariants.policy.js';
import type { StudentDetailDto } from '../students.types.js';
import { StudentAccessService } from './student-access.service.js';
import { StudentQueryService } from './student-query.service.js';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface CandidateDob {
  text: string;
  date: Date;
}

type LockedStudent = Prisma.UserGetPayload<{
  include: { studentProfile: { include: { consent: true } } };
}>;

/** Profile maintenance for students: fields, status and DOB consent lock. */
@Injectable()
export class StudentCrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudentAccessService,
    private readonly queries: StudentQueryService,
  ) {}

  async updateStudent(
    actor: AuthenticatedUser,
    studentId: string,
    dto: UpdateStudentDto,
  ): Promise<StudentDetailDto> {
    if (dto.internalNotes !== undefined) {
      this.access.assertCanWriteInternalNotes(actor);
    }
    assertValidContactFields(dto);
    const candidateDob = this.parseCandidateDob(dto.dateOfBirth);

    try {
      await this.prisma.$transaction(async (tx) => {
        // Determine locking strategy without acquiring out-of-order locks
        const preliminary = await tx.user.findUnique({
          where: { id: studentId },
          select: { roles: true, status: true },
        });
        if (!preliminary || !preliminary.roles.includes(Role.STUDENT)) {
          throw new NotFoundException('Không tìm thấy học viên');
        }

        // Check actor permissions before locking or evaluating pool state
        assertActorMayModifyAccount(actor, preliminary.roles);

        const nextStatus = dto.status ?? preliminary.status;

        // Superadmin may not self-deactivate
        assertSuperadminNotSelfDeactivating(
          actor,
          { id: studentId, roles: preliminary.roles },
          nextStatus,
        );

        const leavingSuperadmin = isLeavingActiveSuperadmin(
          preliminary.roles,
          nextStatus,
        );

        let lockedSuperadmins: LockedUserRow[] | undefined;
        if (leavingSuperadmin) {
          lockedSuperadmins = await lockUserAndActiveSuperadmins(tx, studentId);
          assertAnotherActiveSuperadminRemains(studentId, lockedSuperadmins);
        } else {
          await lockTargetUser(tx, studentId);
        }

        const targetUser = await tx.user.findUnique({
          where: { id: studentId },
          include: { studentProfile: { include: { consent: true } } },
        });
        if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
          throw new NotFoundException('Không tìm thấy học viên');
        }

        // Re-check actor permissions on freshly locked target roles to eliminate race window (F1)
        assertActorMayModifyAccount(actor, targetUser.roles);
        assertSuperadminNotSelfDeactivating(
          actor,
          { id: studentId, roles: targetUser.roles },
          nextStatus,
        );
        if (
          isLeavingActiveSuperadmin(targetUser.roles, nextStatus) &&
          !leavingSuperadmin
        ) {
          lockedSuperadmins = await lockUserAndActiveSuperadmins(tx, studentId);
          assertAnotherActiveSuperadminRemains(studentId, lockedSuperadmins);
        }

        const nextFullName =
          dto.fullName !== undefined ? dto.fullName.trim() : targetUser.fullName;
        const nextEmail =
          dto.email !== undefined ? normalizeEmail(dto.email) : targetUser.email;
        const nextPhone =
          dto.phone !== undefined ? dto.phone.trim() : targetUser.phone;

        const newDobDate = this.resolveDateOfBirthChange(
          targetUser,
          candidateDob,
        );

        if (dto.status !== undefined) {
          await this.assertStatusTransitionAllowed(
            tx,
            targetUser,
            nextStatus,
          );
        }

        // If the account also has TEACHER role, forbid deactivating
        // while leading active or upcoming classes, matching Teachers/SystemSettings.
        if (
          nextStatus === UserStatus.INACTIVE &&
          targetUser.roles.includes(Role.TEACHER)
        ) {
          const teacherProfile = await tx.teacherProfile.findUnique({
            where: { userId: targetUser.id },
          });
          const { effective } = await countEffectiveActiveClasses(
            tx,
            targetUser.id,
            teacherProfile?.activeClassesCount ?? 0,
          );
          assertNoActiveClassesLed(effective);
        }

        await this.assertContactsUnique(
          tx,
          targetUser,
          nextEmail,
          nextPhone,
        );

        const emailChanged = nextEmail !== targetUser.email;
        const isDeactivating =
          nextStatus === UserStatus.INACTIVE &&
          targetUser.status !== UserStatus.INACTIVE;
        const shouldRevokeTokens = isDeactivating || emailChanged;

        // Write only the columns supplied by the DTO so a concurrent
        // assignInitialClass / profile edit is never overwritten (lost update).
        const userUpdateData: Prisma.UserUpdateInput = {
          ...(dto.fullName !== undefined ? { fullName: nextFullName } : {}),
          ...(dto.email !== undefined ? { email: nextEmail } : {}),
          ...(dto.phone !== undefined ? { phone: nextPhone } : {}),
          ...(dto.status !== undefined ? { status: nextStatus } : {}),
          ...(shouldRevokeTokens ? { tokenVersion: { increment: 1 } } : {}),
        };
        if (Object.keys(userUpdateData).length > 0) {
          await tx.user.update({ where: { id: studentId }, data: userUpdateData });
        }

        if (
          targetUser.studentProfile &&
          (newDobDate !== undefined || dto.internalNotes !== undefined)
        ) {
          await tx.studentProfile.update({
            where: { userId: studentId },
            data: {
              ...(newDobDate ? { dateOfBirth: newDobDate } : {}),
              ...(dto.internalNotes !== undefined
                ? { internalNotes: dto.internalNotes.trim() || null }
                : {}),
            },
          });
        }

        await writeAuditLog(tx, actor, {
          action: 'UPDATE_STUDENT',
          targetType: 'User',
          targetId: studentId,
          metadata: {
            fullName: nextFullName,
            email: nextEmail,
            phone: nextPhone,
            status: nextStatus,
            ...(newDobDate ? { dateOfBirth: formatIsoDateUtc(newDobDate) } : {}),
          },
        });
      });
    } catch (err: unknown) {
      rethrowDuplicateContactConflict(err);
    }

    return this.queries.getStudentById(actor, studentId);
  }

  private parseCandidateDob(
    rawDateOfBirth: string | undefined,
  ): CandidateDob | undefined {
    if (rawDateOfBirth === undefined) {
      return undefined;
    }
    const text = rawDateOfBirth.trim();
    if (!ISO_DATE_REGEX.test(text)) {
      throw new BadRequestException('Ngày sinh không hợp lệ (YYYY-MM-DD)');
    }
    const date = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || formatIsoDateUtc(date) !== text) {
      throw new BadRequestException('Ngày sinh không hợp lệ');
    }
    return { text, date };
  }

  /**
   * Invariants for changing DOB. Returns the new DOB to persist, or
   * undefined when DOB is unchanged / not supplied.
   */
  private resolveDateOfBirthChange(
    targetUser: LockedStudent,
    candidate: CandidateDob | undefined,
  ): Date | undefined {
    if (!candidate) {
      return undefined;
    }
    const currentDobText = targetUser.studentProfile
      ? formatIsoDateUtc(targetUser.studentProfile.dateOfBirth)
      : null;
    if (candidate.text === currentDobText) {
      return undefined;
    }

    // Invariant 1: If GuardianConsent exists, DOB is permanently locked
    if (targetUser.studentProfile?.consent) {
      throw new BadRequestException(
        'Ngày sinh đã bị khóa sau khi xác nhận đồng ý của cha mẹ',
      );
    }

    // Invariant 2: If no GuardianConsent, compute age at registration time (user.createdAt)
    const ageAtRegistration = calculateAgeInVnTimezone(
      candidate.text,
      targetUser.createdAt,
    );
    if (ageAtRegistration < 12) {
      throw new BadRequestException('Học viên phải từ 12 tuổi trở lên');
    }
    if (ageAtRegistration < 16) {
      throw new BadRequestException(
        'Không thể sửa ngày sinh: học viên dưới 16 tuổi cần xác nhận đồng ý của cha mẹ khi đăng ký',
      );
    }
    return candidate.date;
  }

  /**
   * Forbid bypassing initial class assignment, reactivating a
   * dropped student without a valid enrollment, or re-queueing an enrolled student.
   */
  private async assertStatusTransitionAllowed(
    tx: Prisma.TransactionClient,
    targetUser: LockedStudent,
    nextStatus: UserStatus,
  ): Promise<void> {
    const isPureStudent =
      targetUser.roles.length === 1 && targetUser.roles[0] === Role.STUDENT;
    const { hasActiveOrCompletedEnrollment, hasEverBeenEnrolled } =
      await loadEnrollmentFacts(tx, targetUser.id, targetUser.studentProfile);

    if (
      nextStatus === UserStatus.ACTIVE &&
      (targetUser.status === UserStatus.PENDING_CLASS ||
        (isPureStudent && !hasActiveOrCompletedEnrollment))
    ) {
      throw new BadRequestException(
        'Tài khoản chờ xếp lớp chỉ được kích hoạt thông qua nghiệp vụ Xếp lớp ban đầu',
      );
    }

    if (
      nextStatus === UserStatus.PENDING_CLASS &&
      targetUser.status !== UserStatus.PENDING_CLASS &&
      !(isPureStudent && !hasEverBeenEnrolled)
    ) {
      throw new BadRequestException(
        'Không thể chuyển học viên đã xếp lớp về lại trạng thái Chờ xếp lớp',
      );
    }
  }

  private async assertContactsUnique(
    tx: Prisma.TransactionClient,
    targetUser: LockedStudent,
    nextEmail: string,
    nextPhone: string,
  ): Promise<void> {
    if (nextEmail === targetUser.email && nextPhone === targetUser.phone) {
      return;
    }
    const duplicate = await tx.user.findFirst({
      where: {
        id: { not: targetUser.id },
        OR: [{ email: nextEmail }, { phone: nextPhone }],
      },
    });
    if (duplicate) {
      throw new ConflictException('Email/Số điện thoại đã được sử dụng');
    }
  }
}
