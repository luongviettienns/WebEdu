import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ClassStatus,
  EnrollmentStatus,
  Role,
  SessionStatus,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { formatIsoDateUtc, resolveVnToday } from '../../../common/utils/timezone.util.js';
import { AttendancePolicy } from '../../attendance/policies/attendance.policy.js';
import type { AdminOverviewQueryDto } from '../dto/progress.dto.js';
import {
  computeAverageAttendanceRate,
  findNextScheduledFromList,
  groupByKey,
  toAdminOverviewSessionDto,
} from '../mappers/progress.mapper.js';
import { computeSessionProgressStats } from '../policies/grade-calculation.policy.js';
import type {
  AdminOverviewClassItemDto,
  AdminOverviewResponseDto,
} from '../progress.types.js';

const CLASS_STATUS_SORT_ORDER: Record<ClassStatus, number> = {
  [ClassStatus.ACTIVE]: 0,
  [ClassStatus.UPCOMING]: 1,
  [ClassStatus.COMPLETED]: 2,
  [ClassStatus.ARCHIVED]: 3,
};

@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendancePolicy: AttendancePolicy,
  ) {}

  async getOverview(
    actor: AuthenticatedUser,
    query: AdminOverviewQueryDto = {},
  ): Promise<AdminOverviewResponseDto> {
    if (!actor.roles.includes(Role.ADMIN)) {
      throw new ForbiddenException('Chỉ Quản trị viên mới có quyền xem tổng quan hệ thống');
    }

    const classWhere: Prisma.ClassWhereInput = {};
    if (query.courseId?.trim()) {
      classWhere.courseId = query.courseId.trim();
    }
    if (query.teacherId?.trim()) {
      classWhere.teacherId = query.teacherId.trim();
    }
    const includeEnded = query.includeEnded === true || query.includeEnded === 'true';
    if (query.status) {
      classWhere.status = query.status;
    } else if (!includeEnded) {
      classWhere.status = { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] };
    }

    const todayVn = resolveVnToday(new Date());
    const plus5DaysVn = new Date(todayVn.getTime() + 5 * 86_400_000);

    const [
      activeClassesCount,
      upcomingClassesCount,
      activeStudentsCount,
      pendingEnrollmentCount,
      matchingClasses,
      windowSessions,
      courses,
      teachers,
    ] = await Promise.all([
      this.prisma.class.count({ where: { status: ClassStatus.ACTIVE } }),
      this.prisma.class.count({ where: { status: ClassStatus.UPCOMING } }),
      this.prisma.user.count({
        where: { roles: { has: Role.STUDENT }, status: UserStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { roles: { has: Role.STUDENT }, status: UserStatus.PENDING_CLASS },
      }),
      this.prisma.class.findMany({
        where: classWhere,
        select: {
          id: true,
          code: true,
          courseId: true,
          teacherId: true,
          status: true,
          startDate: true,
          totalSessions: true,
          expectedEndDate: true,
          course: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.lessonSession.findMany({
        where: {
          sessionDate: { gte: todayVn, lte: plus5DaysVn },
          status: { not: SessionStatus.CANCELLED },
        },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          classId: true,
          sessionNumber: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          status: true,
          isMakeup: true,
          class: {
            select: {
              code: true,
              course: { select: { name: true } },
              teacher: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.course.findMany({
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { roles: { has: Role.TEACHER } },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true },
      }),
    ]);

    const classIds = matchingClasses.map((cls) => cls.id);
    const [classSessions, classEnrollments, classAttendance] =
      classIds.length > 0
        ? await Promise.all([
            this.prisma.lessonSession.findMany({
              where: { classId: { in: classIds } },
              orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                classId: true,
                sessionNumber: true,
                sessionDate: true,
                startTime: true,
                endTime: true,
                status: true,
                isMakeup: true,
              },
            }),
            this.prisma.enrollment.findMany({
              where: { classId: { in: classIds } },
              select: {
                classId: true,
                studentId: true,
                status: true,
                enrolledDate: true,
                leftDate: true,
              },
            }),
            this.prisma.attendanceRecord.findMany({
              where: { classId: { in: classIds } },
              select: { classId: true, sessionId: true, studentId: true, status: true },
            }),
          ])
        : [[], [], []];

    const sessionsByClass = groupByKey(classSessions, (s) => s.classId);
    const enrollmentsByClass = groupByKey(classEnrollments, (e) => e.classId);
    const attendanceByClass = groupByKey(classAttendance, (r) => r.classId);

    const sortedClasses = [...matchingClasses].sort((a, b) => {
      const statusDiff =
        (CLASS_STATUS_SORT_ORDER[a.status] ?? 9) - (CLASS_STATUS_SORT_ORDER[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      const startDiff = b.startDate.getTime() - a.startDate.getTime();
      if (startDiff !== 0) return startDiff;
      return a.code.localeCompare(b.code);
    });

    const classes: AdminOverviewClassItemDto[] = sortedClasses.map((cls) => {
      const sessions = sessionsByClass.get(cls.id) ?? [];
      const enrollments = enrollmentsByClass.get(cls.id) ?? [];
      const records = attendanceByClass.get(cls.id) ?? [];

      const completedSessionsCount = sessions.filter(
        (s) => s.status === SessionStatus.COMPLETED,
      ).length;
      const progress = computeSessionProgressStats(cls.totalSessions, completedSessionsCount);
      const isEnded = cls.status === ClassStatus.COMPLETED || cls.status === ClassStatus.ARCHIVED;
      const enrolledCount = enrollments.filter((e) =>
        isEnded
          ? e.status === EnrollmentStatus.ACTIVE || e.status === EnrollmentStatus.COMPLETED
          : e.status === EnrollmentStatus.ACTIVE,
      ).length;

      const sessionById = new Map(sessions.map((s) => [s.id, s]));
      const enrollmentsByStudent = groupByKey(enrollments, (e) => e.studentId);
      const averageAttendanceRatePercent = computeAverageAttendanceRate(
        records,
        sessionById,
        enrollmentsByStudent,
        this.attendancePolicy,
      );

      return {
        classId: cls.id,
        classCode: cls.code,
        courseId: cls.courseId,
        courseName: cls.course.name,
        teacherId: cls.teacherId,
        teacherName: cls.teacher.fullName,
        status: cls.status,
        enrolledCount,
        completedSessionsCount,
        totalSessions: cls.totalSessions,
        remainingSessionsCount: progress.remainingSessionsCount,
        progressPercent: progress.progressPercent,
        expectedEndDate: cls.expectedEndDate ? formatIsoDateUtc(cls.expectedEndDate) : null,
        nextSession: findNextScheduledFromList(sessions),
        averageAttendanceRatePercent,
      };
    });

    const todayMs = todayVn.getTime();
    const todaySessions = windowSessions
      .filter((s) => s.sessionDate.getTime() === todayMs)
      .map(toAdminOverviewSessionDto);
    const upcomingSessions = windowSessions
      .filter((s) => s.sessionDate.getTime() > todayMs && s.status === SessionStatus.SCHEDULED)
      .map(toAdminOverviewSessionDto);

    return {
      kpis: {
        activeClassesCount,
        upcomingClassesCount,
        activeStudentsCount,
        pendingEnrollmentCount,
        todaySessionsCount: todaySessions.length,
      },
      classes,
      todaySessions,
      upcomingSessions,
      filterOptions: { courses, teachers },
    };
  }
}
