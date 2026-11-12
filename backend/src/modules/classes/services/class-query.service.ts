import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type {
  GetClassDetailQueryDto,
  ListClassesQueryDto,
  PreviewClassScheduleDto,
} from '../dto/classes.dto.js';
import type {
  ClassDetailDto,
  ClassListResponseDto,
} from '../classes.types.js';
import {
  CLASS_ITEM_INCLUDE,
  toClassDetailDto,
  toClassItemDto,
  validateClassTotalSessions,
  type ClassDetailEntity,
  type ClassItemEntity,
} from '../mappers/class.mapper.js';
import {
  assertValidTimeRange,
  calculateExpectedEndDate,
  findTeacherScheduleConflictWarning,
  formatScheduleText,
  normalizeScheduleDays,
  parseRequiredCalendarDate,
} from '../policies/class-schedule.util.js';
import { ClassAccessService } from './class-access.service.js';

const CLASS_DETAIL_INCLUDE = {
  course: {
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      defaultSessions: true,
    },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  enrollments: {
    orderBy: [{ status: 'asc' }, { enrolledDate: 'desc' }],
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  teacherHistory: {
    orderBy: [{ assignedFrom: 'desc' }, { createdAt: 'desc' }],
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      changedBy: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
  _count: {
    select: { enrollments: true },
  },
} satisfies Prisma.ClassInclude;

@Injectable()
export class ClassQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassAccessService,
  ) {}

  async listClasses(
    actor: AuthenticatedUser,
    query: ListClassesQueryDto = {},
  ): Promise<ClassListResponseDto> {
    const scope = this.access.assertCanListClasses(actor);
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.ClassWhereInput = {};

    if (scope.restrictToTeacherId) {
      where.teacherId = scope.restrictToTeacherId;
    } else if (query.teacherId?.trim()) {
      where.teacherId = query.teacherId.trim();
    }

    if (query.courseId?.trim()) {
      where.courseId = query.courseId.trim();
    }

    if (query.excludeClassId?.trim()) {
      where.id = { not: query.excludeClassId.trim() };
    }

    const includeEnded =
      query.includeEnded === true || query.includeEnded === 'true';
    if (query.status) {
      where.status = query.status;
    } else if (!includeEnded) {
      where.status = { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] };
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { course: { name: { contains: search, mode: 'insensitive' } } },
        { teacher: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        include: CLASS_ITEM_INCLUDE,
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }, { code: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.class.count({ where }),
    ]);

    const items = (rows as unknown as ClassItemEntity[]).map((row) =>
      toClassItemDto(row),
    );

    return { items, total, page, limit };
  }

  async getClassById(
    actor: AuthenticatedUser,
    classId: string,
    query?: GetClassDetailQueryDto,
  ): Promise<ClassDetailDto> {
    const cls = (await this.prisma.class.findUnique({
      where: { id: classId },
      include: CLASS_DETAIL_INCLUDE,
    })) as unknown as ClassDetailEntity | null;

    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    const accessMode = this.access.resolveClassDetailAccess(actor, cls);
    const includeInactive =
      query?.includeInactiveEnrollments === true ||
      query?.includeInactiveEnrollments === 'true';

    const isEndedClass =
      cls.status === ClassStatus.COMPLETED ||
      cls.status === ClassStatus.ARCHIVED;

    const scheduleConflictWarning = isEndedClass
      ? null
      : await findTeacherScheduleConflictWarning(
          this.prisma,
          cls.teacherId,
          {
            scheduleDays: cls.scheduleDays,
            scheduleStartTime: cls.scheduleStartTime,
            scheduleEndTime: cls.scheduleEndTime,
            startDate: cls.startDate,
            endDate: cls.actualEndDate ?? cls.expectedEndDate,
          },
          cls.id,
        );

    const filteredEnrollments = includeInactive
      ? cls.enrollments
      : cls.enrollments.filter((e) =>
          isEndedClass
            ? e.status === EnrollmentStatus.ACTIVE ||
              e.status === EnrollmentStatus.COMPLETED
            : e.status === EnrollmentStatus.ACTIVE,
        );

    return toClassDetailDto(
      {
        ...cls,
        enrollments: filteredEnrollments,
      },
      accessMode,
      scheduleConflictWarning,
      {
        effectiveRole: this.access.resolveEffectiveRole(actor),
        capabilities: this.access.resolveCapabilities(actor, cls),
      },
    );
  }

  async previewSchedule(dto: PreviewClassScheduleDto): Promise<{
    normalizedScheduleDays: number[];
    scheduleText: string;
    expectedEndDate: string;
    totalSessions: number;
    scheduleConflictWarning: string | null;
  }> {
    const normalizedDays = normalizeScheduleDays(dto.scheduleDays ?? []);
    const { startTime, endTime } = assertValidTimeRange(
      dto.scheduleStartTime ?? '',
      dto.scheduleEndTime ?? '',
    );
    const startDate = parseRequiredCalendarDate(
      dto.startDate,
      'Ngày khai giảng không hợp lệ',
    );
    const totalSessions = validateClassTotalSessions(dto.totalSessions);
    const expectedEndDate = calculateExpectedEndDate(
      startDate,
      normalizedDays,
      totalSessions,
    );

    const scheduleConflictWarning = dto.teacherId?.trim()
      ? await findTeacherScheduleConflictWarning(
          this.prisma,
          dto.teacherId.trim(),
          {
            scheduleDays: normalizedDays,
            scheduleStartTime: startTime,
            scheduleEndTime: endTime,
            startDate,
            endDate: expectedEndDate,
          },
          dto.excludeClassId?.trim() || undefined,
        )
      : null;

    return {
      normalizedScheduleDays: normalizedDays,
      scheduleText: formatScheduleText(normalizedDays, startTime, endTime),
      expectedEndDate: formatIsoDateUtc(expectedEndDate),
      totalSessions,
      scheduleConflictWarning,
    };
  }
}
