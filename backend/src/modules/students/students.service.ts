import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  calculateAgeInVnTimezone,
  formatDateTimeVn,
} from '../../common/utils/timezone.util.js';
import { sanitizeAuditMetadata } from '../../common/utils/audit-sanitize.util.js';
import { formatIsoDateUtc } from '../auth/auth.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type {
  AssignInitialClassDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from './dto/students.dto.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export type GuardianConsentStatus = 'CONFIRMED' | 'NOT_APPLICABLE';
export type ClassLifecycleStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface TeacherClassStudentAssignment {
  classId: string;
  assignedTeacherId: string;
  studentIds: string[];
  classStatus: ClassLifecycleStatus;
}

export interface PendingStudentDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  guardianEmail: string | null;
  guardianConsentStatus: GuardianConsentStatus;
  createdAt: string;
}

export interface StudentListItemDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  dateOfBirth: string | null;
  guardianEmail: string | null;
  guardianConsentStatus: GuardianConsentStatus;
  assignedClass: string | null;
  enrolledAt: string | null;
}

export interface StudentDetailDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  roles: Role[];
  dateOfBirth: string | null;
  dateOfBirthLocked: boolean;
  hasGuardianConsent: boolean;
  guardianEmail: string | null;
  assignedClass: string | null;
  enrolledAt: string | null;
  internalNotes: string | null;
  guardianConsent: {
    consented: boolean;
    consentedAt: string;
    guardianEmail: string;
    consentVersion: string;
    formattedDisplay: string;
  } | null;
}

@Injectable()
export class StudentsService {
  // Phase 2 fail-closed registry until Phase 3 Class & ClassEnrollment tables are introduced
  private readonly teacherClassAssignments: TeacherClassStudentAssignment[] = [];

  constructor(private readonly prisma: PrismaService) {}

  private hasTeacherStudentClassAssignment(
    teacherId: string,
    studentId: string,
  ): boolean {
    return this.teacherClassAssignments.some(
      (assignment) =>
        assignment.assignedTeacherId === teacherId &&
        assignment.studentIds.includes(studentId),
    );
  }

  private toStudentDetailDto(
    user: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
      status: UserStatus;
      roles: Role[];
      studentProfile?: {
        dateOfBirth: Date;
        guardianEmail: string | null;
        assignedClass: string | null;
        internalNotes: string | null;
        enrolledAt: Date | null;
        consent?: {
          consentedAt: Date;
          guardianEmail: string;
          consentVersion: string;
        } | null;
      } | null;
    },
    actorRoles: Role[],
  ): StudentDetailDto {
    const profile = user.studentProfile;
    const consent = profile?.consent ?? null;
    const canViewInternalNotes = actorRoles.includes(Role.ADMIN);

    // Cleanup #13: Strictly omit createdAt / registeredAt ("Đăng ký lúc") on Student Detail DTO
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: user.roles,
      dateOfBirth: profile ? formatIsoDateUtc(profile.dateOfBirth) : null,
      dateOfBirthLocked: Boolean(consent),
      hasGuardianConsent: Boolean(consent),
      guardianEmail: profile?.guardianEmail ?? null,
      assignedClass: profile?.assignedClass ?? null,
      enrolledAt: profile?.enrolledAt ? profile.enrolledAt.toISOString() : null,
      internalNotes: canViewInternalNotes ? (profile?.internalNotes ?? null) : null,
      guardianConsent: consent
        ? {
            consented: true,
            consentedAt: consent.consentedAt.toISOString(),
            guardianEmail: consent.guardianEmail,
            consentVersion: consent.consentVersion,
            formattedDisplay: `Đã xác nhận đồng ý của cha mẹ – ${formatDateTimeVn(
              consent.consentedAt,
            )}`,
          }
        : null,
    };
  }

  async listStudents(query: ListStudentsQueryDto): Promise<{
    items: StudentListItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const search = query.search?.trim();
    const className = query.className?.trim();
    const where: Prisma.UserWhereInput = {
      roles: { has: Role.STUDENT },
      ...(query.status ? { status: query.status } : {}),
      ...(className
        ? { studentProfile: { assignedClass: className } }
        : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          studentProfile: {
            include: { consent: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items: StudentListItemDto[] = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      status: u.status,
      dateOfBirth: u.studentProfile
        ? formatIsoDateUtc(u.studentProfile.dateOfBirth)
        : null,
      guardianEmail: u.studentProfile?.guardianEmail ?? null,
      guardianConsentStatus: u.studentProfile?.consent
        ? 'CONFIRMED'
        : 'NOT_APPLICABLE',
      assignedClass: u.studentProfile?.assignedClass ?? null,
      enrolledAt: u.studentProfile?.enrolledAt
        ? u.studentProfile.enrolledAt.toISOString()
        : null,
    }));

    return { items, total, page, limit };
  }

  async getPendingEnrollmentQueue(): Promise<{
    items: PendingStudentDto[];
    totalPending: number;
  }> {
    const users = await this.prisma.user.findMany({
      where: {
        roles: { has: Role.STUDENT },
        status: UserStatus.PENDING_CLASS,
      },
      include: {
        studentProfile: {
          include: { consent: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Cleanup #12: guardianConsentStatus is strictly 'CONFIRMED' | 'NOT_APPLICABLE' (never 'MISSING')
    const items: PendingStudentDto[] = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      dateOfBirth: u.studentProfile
        ? formatIsoDateUtc(u.studentProfile.dateOfBirth)
        : null,
      guardianEmail: u.studentProfile?.guardianEmail ?? null,
      guardianConsentStatus: u.studentProfile?.consent
        ? 'CONFIRMED'
        : 'NOT_APPLICABLE',
      createdAt: u.createdAt.toISOString(),
    }));

    return {
      items,
      totalPending: items.length,
    };
  }

  async getStudentById(
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentDetailDto> {
    const canViewAnyProfile =
      actor.roles.includes(Role.ADMIN) || actor.roles.includes(Role.SUPERADMIN);

    if (!canViewAnyProfile) {
      const canViewSelf =
        actor.roles.includes(Role.STUDENT) && actor.id === studentId;
      if (!canViewSelf) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập hồ sơ của học viên khác',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: {
        studentProfile: {
          include: { consent: true },
        },
      },
    });

    if (!user || !user.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    return this.toStudentDetailDto(user, actor.roles);
  }

  async updateStudent(
    actor: AuthenticatedUser,
    studentId: string,
    dto: UpdateStudentDto,
  ): Promise<StudentDetailDto> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: {
        studentProfile: {
          include: { consent: true },
        },
      },
    });

    if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    // SEC-08: ADMIN cannot modify or lock any ADMIN or SUPERADMIN account
    if (
      (targetUser.roles.includes(Role.SUPERADMIN) ||
        targetUser.roles.includes(Role.ADMIN)) &&
      !actor.roles.includes(Role.SUPERADMIN)
    ) {
      throw new ForbiddenException(
        'Admin không có quyền chỉnh sửa hoặc khóa tài khoản Quản trị viên / Quản trị tối cao',
      );
    }

    const nextFullName =
      dto.fullName !== undefined ? dto.fullName.trim() : targetUser.fullName;
    if (!nextFullName) {
      throw new BadRequestException('Họ và tên không được để trống');
    }

    const nextEmail =
      dto.email !== undefined
        ? dto.email.trim().toLowerCase()
        : targetUser.email;
    if (!EMAIL_REGEX.test(nextEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const nextPhone =
      dto.phone !== undefined ? dto.phone.trim() : targetUser.phone;
    if (!PHONE_REGEX.test(nextPhone)) {
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
    }

    const currentDobStr = targetUser.studentProfile
      ? formatIsoDateUtc(targetUser.studentProfile.dateOfBirth)
      : null;

    let newDobDate: Date | undefined;
    if (dto.dateOfBirth !== undefined) {
      const candidateDobStr = dto.dateOfBirth.trim();
      if (!ISO_DATE_REGEX.test(candidateDobStr)) {
        throw new BadRequestException('Ngày sinh không hợp lệ (YYYY-MM-DD)');
      }
      const parsedDob = new Date(`${candidateDobStr}T00:00:00.000Z`);
      if (
        Number.isNaN(parsedDob.getTime()) ||
        formatIsoDateUtc(parsedDob) !== candidateDobStr
      ) {
        throw new BadRequestException('Ngày sinh không hợp lệ');
      }

      if (candidateDobStr !== currentDobStr) {
        // FUNC-007 Invariant 1: If GuardianConsent exists, DOB is permanently locked
        if (targetUser.studentProfile?.consent) {
          throw new BadRequestException(
            'Ngày sinh đã bị khóa sau khi xác nhận đồng ý của cha mẹ',
          );
        }

        // FUNC-007 Invariant 2: If no GuardianConsent, compute age at registration time (user.createdAt)
        const ageAtRegistration = calculateAgeInVnTimezone(
          candidateDobStr,
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

        newDobDate = parsedDob;
      }
    }

    if (nextEmail !== targetUser.email || nextPhone !== targetUser.phone) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          id: { not: studentId },
          OR: [{ email: nextEmail }, { phone: nextPhone }],
        },
      });
      if (duplicate) {
        throw new ConflictException('Email/Số điện thoại đã được sử dụng');
      }
    }

    const nextStatus = dto.status ?? targetUser.status;
    const isLeavingActiveSuperadmin =
      targetUser.roles.includes(Role.SUPERADMIN) &&
      nextStatus !== UserStatus.ACTIVE;

    if (isLeavingActiveSuperadmin && actor.id === targetUser.id) {
      throw new BadRequestException(
        'Superadmin không thể tự vô hiệu hóa tài khoản của chính mình',
      );
    }

    const emailChanged = nextEmail !== targetUser.email;
    const isDeactivating =
      nextStatus === UserStatus.INACTIVE &&
      targetUser.status !== UserStatus.INACTIVE;
    const shouldRevokeTokens = isDeactivating || emailChanged;

    await this.prisma.$transaction(async (tx) => {
      if (isLeavingActiveSuperadmin) {
        const activeSuperadmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "users" WHERE 'SUPERADMIN' = ANY("roles") AND "status" = 'ACTIVE' FOR UPDATE
        `;
        const otherActiveCount = activeSuperadmins.filter(
          (row) => row.id !== targetUser.id,
        ).length;
        if (otherActiveCount < 1) {
          throw new BadRequestException(
            'Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động',
          );
        }
      }

      await tx.user.update({
        where: { id: studentId },
        data: {
          fullName: nextFullName,
          email: nextEmail,
          phone: nextPhone,
          status: nextStatus,
          ...(shouldRevokeTokens ? { tokenVersion: { increment: 1 } } : {}),
        },
      });

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

      await tx.systemAuditLog.create({
        data: {
          actorId: actor.id,
          actingRole: actor.effectiveRole,
          action: 'UPDATE_STUDENT',
          targetType: 'User',
          targetId: studentId,
          metadata: sanitizeAuditMetadata({
            fullName: nextFullName,
            email: nextEmail,
            phone: nextPhone,
            status: nextStatus,
            ...(newDobDate ? { dateOfBirth: formatIsoDateUtc(newDobDate) } : {}),
          }) as Prisma.InputJsonValue,
        },
      });
    });

    return this.getStudentById(actor, studentId);
  }

  async assignInitialClass(
    actor: AuthenticatedUser,
    studentId: string,
    dto: AssignInitialClassDto,
  ): Promise<StudentDetailDto> {
    const classNameOrId = (dto.classNameOrId ?? '').trim();
    if (!classNameOrId) {
      throw new BadRequestException('Lớp học xếp ban đầu không được để trống');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: {
        studentProfile: {
          include: { consent: true },
        },
      },
    });

    if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    if (
      (targetUser.roles.includes(Role.SUPERADMIN) ||
        targetUser.roles.includes(Role.ADMIN)) &&
      !actor.roles.includes(Role.SUPERADMIN)
    ) {
      throw new ForbiddenException(
        'Admin không có quyền chỉnh sửa hoặc khóa tài khoản Quản trị viên / Quản trị tối cao',
      );
    }

    if (targetUser.status !== UserStatus.PENDING_CLASS) {
      throw new BadRequestException(
        'Chỉ có thể xếp lớp lần đầu cho học viên đang ở trạng thái Chờ xếp lớp',
      );
    }

    const enrolledDate = dto.enrolledAt ? new Date(dto.enrolledAt) : new Date();
    if (Number.isNaN(enrolledDate.getTime())) {
      throw new BadRequestException('Thời điểm xếp lớp (enrolledAt) không hợp lệ');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: studentId },
        data: {
          status: UserStatus.ACTIVE,
        },
      });

      if (targetUser.studentProfile) {
        await tx.studentProfile.update({
          where: { userId: studentId },
          data: {
            assignedClass: classNameOrId,
            enrolledAt: enrolledDate,
          },
        });
      }

      await tx.systemAuditLog.create({
        data: {
          actorId: actor.id,
          actingRole: actor.effectiveRole,
          action: 'ASSIGN_INITIAL_CLASS',
          targetType: 'User',
          targetId: studentId,
          metadata: sanitizeAuditMetadata({
            classNameOrId,
            enrolledAt: enrolledDate.toISOString(),
            previousStatus: targetUser.status,
            newStatus: UserStatus.ACTIVE,
          }) as Prisma.InputJsonValue,
        },
      });
    });

    return this.getStudentById(actor, studentId);
  }

  async getStudentLearningRecords(
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<{
    studentId: string;
    records: Array<Record<string, unknown>>;
    message: string;
  }> {
    if (actor.roles.includes(Role.ADMIN)) {
      // Admin has full access to academic learning records (FUNC-009, DEC-026)
    } else if (actor.roles.includes(Role.STUDENT) && actor.id === studentId) {
      // Student viewing own learning records (FUNC-010)
    } else if (actor.roles.includes(Role.TEACHER)) {
      const isAssigned = this.hasTeacherStudentClassAssignment(
        actor.id,
        studentId,
      );
      if (!isAssigned) {
        throw new ForbiddenException(
          'Giáo viên chỉ được truy cập dữ liệu học tập của học viên thuộc lớp mình đang hoặc đã hoàn thành phụ trách',
        );
      }
    } else {
      throw new ForbiddenException('Bạn không có quyền truy cập');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: studentId },
    });

    if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    return {
      studentId,
      records: [],
      message: 'Dữ liệu học tập học viên',
    };
  }

  /**
   * DEC-024: Quyền xem lịch sử lớp của học viên:
   * - Học viên: chỉ xem lịch sử lớp của chính mình.
   * - Giáo viên hiện tại: KHÔNG được xem lịch sử lớp cũ của học viên.
   * - Admin: xem lịch sử của tất cả học viên.
   * - Superadmin (thuần): không được xem dữ liệu học tập.
   */
  async getStudentClassHistory(
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<{
    studentId: string;
    currentClass: string | null;
    pastClasses: Array<Record<string, unknown>>;
  }> {
    const canViewClassHistory =
      actor.roles.includes(Role.ADMIN) ||
      (actor.roles.includes(Role.STUDENT) && actor.id === studentId);

    if (!canViewClassHistory) {
      if (actor.roles.includes(Role.TEACHER)) {
        throw new ForbiddenException(
          'Giáo viên không có quyền xem lịch sử lớp cũ của học viên',
        );
      }
      throw new ForbiddenException('Bạn không có quyền truy cập');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: { studentProfile: true },
    });

    if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    return {
      studentId,
      currentClass: targetUser.studentProfile?.assignedClass ?? null,
      pastClasses: [],
    };
  }

  /**
   * DEC-025 & DEC-026: Kiểm tra quyền truy cập dữ liệu lớp học của Giáo viên / Admin:
   * - Admin: có toàn quyền truy cập & thao tác nghiệp vụ đào tạo (DEC-026).
   * - Superadmin thuần: bị chặn truy cập dữ liệu học tập (FUNC-013).
   * - Giáo viên:
   *   + Lớp UPCOMING / ACTIVE do GV đang phụ trách -> FULL.
   *   + Case 1 (DEC-025): Lớp đã kết thúc (COMPLETED/ARCHIVED) mà GV vẫn là người phụ trách -> READ_ONLY.
   *   + Case 2 (DEC-025): GV đang dạy nhưng bị thay bằng GV khác (assignedTeacherId !== actor.id) -> 403 Forbidden.
   */
  verifyClassLearningAccess(
    actor: AuthenticatedUser,
    classContext: {
      classId: string;
      assignedTeacherId: string;
      classStatus: ClassLifecycleStatus;
    },
  ): { allowed: true; mode: 'FULL' | 'READ_ONLY' } {
    if (actor.roles.includes(Role.ADMIN)) {
      return { allowed: true, mode: 'FULL' };
    }

    if (actor.roles.includes(Role.TEACHER)) {
      if (classContext.assignedTeacherId !== actor.id) {
        throw new ForbiddenException(
          'Giáo viên đã được thay thế không còn quyền truy cập lớp học này',
        );
      }
      const isEditableLifecycle =
        classContext.classStatus === 'UPCOMING' ||
        classContext.classStatus === 'ACTIVE';
      return {
        allowed: true,
        mode: isEditableLifecycle ? 'FULL' : 'READ_ONLY',
      };
    }

    throw new ForbiddenException('Bạn không có quyền truy cập');
  }
}
