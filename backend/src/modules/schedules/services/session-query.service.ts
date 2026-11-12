import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, Prisma, SessionChangeAction } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import { formatIsoDateUtc, resolveVnToday } from '../../../common/utils/timezone.util.js';
import type {
  ListCalendarSessionsQueryDto,
  ListClassSessionsQueryDto,
  ListSessionChangeLogsQueryDto,
} from '../dto/schedules.dto.js';
import type {
  ClassSessionsResponseDto,
  LessonSessionItemDto,
  SessionChangeLogListResponseDto,
} from '../schedules.types.js';
import { ScheduleAccessPolicy } from '../policies/schedule-access.policy.js';
import { parseSessionCalendarDateOrThrow } from '../policies/session-schedule.policy.js';
import {
  toLessonSessionItemDto,
  toSessionChangeLogItemDto,
  type LessonSessionEntity,
  type SessionChangeLogEntity,
} from '../mappers/session.mapper.js';

export const SESSION_DETAIL_INCLUDE = {
  class: {
    select: {
      id: true,
      code: true,
      status: true,
      teacherId: true,
      course: { select: { name: true } },
      teacher: { select: { id: true, fullName: true } },
    },
  },
  makeupForSession: {
    select: {
      id: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
      cancelReason: true,
    },
  },
  makeupReplacement: { select: { id: true } },
  attendanceRecords: {
    select: { studentId: true, status: true, note: true },
  },
  changeLogs: {
    where: { action: SessionChangeAction.RESCHEDULE },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      action: true,
      previousDate: true,
      previousStartTime: true,
      previousEndTime: true,
    },
  },
} satisfies Prisma.LessonSessionInclude;

@Injectable()
export class SessionQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScheduleAccessPolicy,
  ) {}

  async listClassSessions(
    actor: AuthenticatedUser,
    classId: string,
    query: ListClassSessionsQueryDto = {},
  ): Promise<ClassSessionsResponseDto> {
    const cls = await this.access.loadClassOrThrow(this.prisma, classId);
    const effectiveRole = await this.access.resolveClassScheduleViewerRole(this.prisma, actor, cls);

    const where: Prisma.LessonSessionWhereInput = { classId };
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.sessionDate = {
        ...(query.from ? { gte: parseSessionCalendarDateOrThrow(query.from, 'Từ ngày') } : {}),
        ...(query.to ? { lte: parseSessionCalendarDateOrThrow(query.to, 'Đến ngày') } : {}),
      };
    }

    const rows = (await this.prisma.lessonSession.findMany({
      where,
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
      include: SESSION_DETAIL_INCLUDE,
    })) as unknown as LessonSessionEntity[];

    const now = new Date();
    const sessions = rows.map((row) => toLessonSessionItemDto(row, actor, effectiveRole, now));

    return {
      classId: cls.id,
      classCode: cls.code,
      classStatus: cls.status,
      effectiveRole,
      summary: this.computeSummary(cls.totalSessions, sessions),
      sessions,
    };
  }

  async getSessionDetail(actor: AuthenticatedUser, sessionId: string): Promise<LessonSessionItemDto> {
    const row = (await this.prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: SESSION_DETAIL_INCLUDE,
    })) as unknown as LessonSessionEntity | null;
    if (!row) throw new NotFoundException('Không tìm thấy buổi học');

    const effectiveRole = await this.access.resolveClassScheduleViewerRole(this.prisma, actor, row.class);
    return toLessonSessionItemDto(row, actor, effectiveRole, new Date());
  }

  async listCalendarSessions(
    actor: AuthenticatedUser,
    query: ListCalendarSessionsQueryDto = {},
  ): Promise<{
    effectiveRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
    from: string;
    to: string;
    items: LessonSessionItemDto[];
  }> {
    const scope = await this.access.resolveCalendarClassScope(
      this.prisma,
      actor,
      query.classId,
      query.teacherId,
    );

    const today = resolveVnToday();
    const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const defaultTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

    const fromDate = query.from ? parseSessionCalendarDateOrThrow(query.from, 'Từ ngày') : defaultFrom;
    const toDate = query.to ? parseSessionCalendarDateOrThrow(query.to, 'Đến ngày') : defaultTo;

    if (toDate.getTime() < fromDate.getTime()) {
      throw new BadRequestException('Đến ngày phải lớn hơn hoặc bằng Từ ngày');
    }
    if (toDate.getTime() - fromDate.getTime() > 93 * 86_400_000) {
      throw new BadRequestException('Khoảng thời gian truy vấn lịch học tối đa là 93 ngày');
    }

    if (scope.classIds && scope.classIds.length === 0) {
      return {
        effectiveRole: scope.effectiveRole,
        from: formatIsoDateUtc(fromDate),
        to: formatIsoDateUtc(toDate),
        items: [],
      };
    }

    const where: Prisma.LessonSessionWhereInput = {
      sessionDate: { gte: fromDate, lte: toDate },
      ...(scope.classIds ? { classId: { in: scope.classIds } } : {}),
      ...(query.status ? { status: query.status } : {}),
      class: {
        ...(scope.teacherId ? { teacherId: scope.teacherId } : {}),
        status: { not: ClassStatus.ARCHIVED },
      },
    };

    const rows = (await this.prisma.lessonSession.findMany({
      where,
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
      include: SESSION_DETAIL_INCLUDE,
    })) as unknown as LessonSessionEntity[];

    const now = new Date();
    return {
      effectiveRole: scope.effectiveRole,
      from: formatIsoDateUtc(fromDate),
      to: formatIsoDateUtc(toDate),
      items: rows.map((row) => toLessonSessionItemDto(row, actor, scope.effectiveRole, now)),
    };
  }

  async listScheduleChangeLogs(
    actor: AuthenticatedUser,
    query: ListSessionChangeLogsQueryDto = {},
  ): Promise<SessionChangeLogListResponseDto> {
    this.access.assertCanViewScheduleLogs(actor);
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.SessionChangeLogWhereInput = {
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...((query.from || query.to)
        ? {
            createdAt: {
              ...(query.from
                ? {
                    gte: new Date(
                      parseSessionCalendarDateOrThrow(query.from, 'Từ ngày').getTime() - 7 * 3_600_000,
                    ),
                  }
                : {}),
              ...(query.to
                ? {
                    lt: new Date(
                      parseSessionCalendarDateOrThrow(query.to, 'Đến ngày').getTime() -
                        7 * 3_600_000 +
                        86_400_000,
                    ),
                  }
                : {}),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.sessionChangeLog.count({ where }),
      this.prisma.sessionChangeLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          class: { select: { code: true } },
          session: { select: { sessionNumber: true } },
        },
      }),
    ]);

    return {
      items: (items as unknown as SessionChangeLogEntity[]).map(toSessionChangeLogItemDto),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private computeSummary(
    totalSessionsTarget: number,
    sessions: ReadonlyArray<LessonSessionItemDto>,
  ) {
    let completedCount = 0;
    let missedAttendanceCount = 0;
    let upcomingCount = 0;
    let cancelledCount = 0;

    for (const s of sessions) {
      if (s.displayStatus === 'COMPLETED') completedCount += 1;
      else if (s.displayStatus === 'MISSED_ATTENDANCE') missedAttendanceCount += 1;
      else if (s.displayStatus === 'CANCELLED') cancelledCount += 1;
      else upcomingCount += 1;
    }

    return {
      totalSessionsTarget,
      activeSessionsCount: sessions.length - cancelledCount,
      completedCount,
      missedAttendanceCount,
      upcomingCount,
      cancelledCount,
    };
  }
}
