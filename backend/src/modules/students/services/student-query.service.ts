import { Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import { buildUserSearchFilter } from '../../../common/utils/user-search.util.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type {
  ListPendingEnrollmentQueryDto,
  ListStudentsQueryDto,
} from '../dto/students.dto.js';
import {
  toLearningRecord,
  toPastClassRecord,
  toPendingStudentDto,
  toStudentDetailDto,
  toStudentListItemDto,
} from '../mappers/student.mapper.js';
import type {
  PaginatedResult,
  PendingStudentDto,
  StudentClassHistoryDto,
  StudentDetailDto,
  StudentLearningRecordsDto,
  StudentListItemDto,
} from '../students.types.js';
import {
  buildTeacherAuthorizedEnrollmentFilter,
  StudentAccessService,
} from './student-access.service.js';

/** Read side of the Students module: lists, detail, learning records, class history. */
@Injectable()
export class StudentQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudentAccessService,
  ) {}

  async listStudents(
    actorOrQuery: AuthenticatedUser | ListStudentsQueryDto,
    maybeQuery?: ListStudentsQueryDto,
  ): Promise<PaginatedResult<StudentListItemDto>> {
    let actor: AuthenticatedUser | undefined;
    let query: ListStudentsQueryDto;

    if (maybeQuery !== undefined) {
      actor = actorOrQuery as AuthenticatedUser;
      query = maybeQuery;
    } else {
      actor = undefined;
      query = actorOrQuery as ListStudentsQueryDto;
    }

    const { page, limit, skip } = resolvePagination(query);

    const canViewClassData = !actor || actor.roles.includes(Role.ADMIN);

    const className = query.className?.trim();
    const where: Prisma.UserWhereInput = {
      roles: { has: Role.STUDENT },
      ...(query.status ? { status: query.status } : {}),
      ...(canViewClassData && className
        ? { studentProfile: { assignedClass: className } }
        : {}),
      ...buildUserSearchFilter(query.search),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { studentProfile: { include: { consent: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => toStudentListItemDto(u, canViewClassData)),
      total,
      page,
      limit,
    };
  }

  async getPendingEnrollmentQueue(
    query?: ListPendingEnrollmentQueryDto,
  ): Promise<
    PaginatedResult<PendingStudentDto> & { totalPending: number }
  > {
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.UserWhereInput = {
      roles: { has: Role.STUDENT },
      status: UserStatus.PENDING_CLASS,
    };

    const [users, totalPending] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { studentProfile: { include: { consent: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map(toPendingStudentDto),
      totalPending,
      total: totalPending,
      page,
      limit,
    };
  }

  async getStudentById(
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentDetailDto> {
    this.access.assertCanViewProfile(actor, studentId);

    const includeEnrollments =
      actor.roles.includes(Role.ADMIN) || actor.id === studentId;

    const user = await (includeEnrollments
      ? this.prisma.user.findUnique({
          where: { id: studentId },
          include: {
            studentProfile: { include: { consent: true } },
            enrollments: {
              where: {
                status: {
                  in: [
                    EnrollmentStatus.TRANSFERRED,
                    EnrollmentStatus.COMPLETED,
                    EnrollmentStatus.DROPPED,
                  ],
                },
              },
              include: {
                class: {
                  include: {
                    course: true,
                    teacher: { select: { fullName: true } },
                  },
                },
              },
              orderBy: [{ enrolledDate: 'desc' }, { createdAt: 'desc' }],
            },
          },
        })
      : this.prisma.user.findUnique({
          where: { id: studentId },
          include: {
            studentProfile: { include: { consent: true } },
          },
        }));

    if (!user || !user.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    return toStudentDetailDto(user, actor.roles, actor.id);
  }

  async getStudentLearningRecords(
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentLearningRecordsDto> {
    const scope = await this.access.resolveLearningRecordScope(actor, studentId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id: studentId },
    });
    if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        ...(scope.restrictToTeacherId
          ? buildTeacherAuthorizedEnrollmentFilter(scope.restrictToTeacherId)
          : {}),
      },
      include: { class: { include: { course: true } } },
      orderBy: { enrolledDate: 'desc' },
    });

    return {
      studentId,
      records: enrollments.map((enrollment) =>
        toLearningRecord(
          enrollment,
          this.access.resolveAccessMode(scope, enrollment),
        ),
      ),
      message: 'Dữ liệu học tập học viên',
    };
  }

  async getStudentClassHistory(
    actor: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentClassHistoryDto> {
    this.access.assertCanViewClassHistory(actor, studentId);

    const targetUser = await this.prisma.user.findUnique({
      where: { id: studentId },
      include: { studentProfile: true },
    });
    if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }

    const historicalEnrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: {
          in: [
            EnrollmentStatus.TRANSFERRED,
            EnrollmentStatus.COMPLETED,
            EnrollmentStatus.DROPPED,
          ],
        },
      },
      include: {
        class: {
          include: {
            course: true,
            teacher: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ enrolledDate: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      studentId,
      currentClass: targetUser.studentProfile?.assignedClass ?? null,
      pastClasses: historicalEnrollments.map(toPastClassRecord),
    };
  }
}
