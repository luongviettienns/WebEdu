import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, ClassStatus, EnrollmentStatus, Role, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';
import { computeSessionDisplayStatus, getWeekdayVnLabel } from '../../schedules/policies/session-schedule.policy.js';
import type {
  ClassAttendanceMatrixDto,
  SessionAttendanceSheetDto,
  StudentMyAttendanceDto,
} from '../attendance.types.js';
import type { GetMyAttendanceQueryDto } from '../dto/attendance.dto.js';
import {
  mapSessionAttendanceSheet,
  type SessionAttendanceSheetEntity,
  type SessionRosterEnrollmentEntity,
} from '../mappers/attendance.mapper.js';
import { AttendancePolicy } from '../policies/attendance.policy.js';

function selectPrimaryEnrollment<T extends { status: EnrollmentStatus; enrolledDate: Date }>(
  rows: T[],
): T {
  const active = rows.find((r) => r.status === EnrollmentStatus.ACTIVE);
  if (active) return active;
  return [...rows].sort((a, b) => b.enrolledDate.getTime() - a.enrolledDate.getTime())[0]!;
}

function groupByKey<T>(rows: T[], getKey: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = getKey(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

@Injectable()
export class AttendanceQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AttendancePolicy,
  ) {}

  async getSessionAttendanceSheet(
    actor: AuthenticatedUser,
    sessionId: string,
  ): Promise<SessionAttendanceSheetDto> {
    const session = (await this.prisma.lessonSession.findUnique({
      where: { id: sessionId },
      include: {
        class: {
          select: {
            id: true,
            code: true,
            status: true,
            teacherId: true,
            course: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
        attendanceRecords: {
          include: {
            markedBy: { select: { fullName: true } },
            updatedBy: { select: { fullName: true } },
          },
        },
        attendanceAudits: {
          orderBy: { createdAt: 'desc' },
          include: {
            student: { select: { fullName: true } },
            actor: { select: { fullName: true } },
          },
        },
      },
    })) as unknown as SessionAttendanceSheetEntity | null;
    if (!session) throw new NotFoundException('Không tìm thấy buổi học');

    this.policy.assertCanReadClassAttendance(actor, session.class);

    const enrollments = (await this.prisma.enrollment.findMany({
      where: {
        classId: session.classId,
        enrolledDate: { lte: session.sessionDate },
        OR: [{ leftDate: null }, { leftDate: { gte: session.sessionDate } }],
      },
      include: {
        student: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
      orderBy: { student: { fullName: 'asc' } },
    })) as unknown as SessionRosterEnrollmentEntity[];

    const isAdmin = actor.roles.includes(Role.ADMIN);
    const isLeadTeacher = actor.roles.includes(Role.TEACHER) && session.class.teacherId === actor.id;
    const isClosedClass =
      session.class.status === ClassStatus.COMPLETED || session.class.status === ClassStatus.ARCHIVED;

    const uniqueEnrollments = Array.from(
      groupByKey(enrollments, (e) => e.studentId).values(),
    ).map(selectPrimaryEnrollment);

    return mapSessionAttendanceSheet(session, uniqueEnrollments, {
      isAdmin,
      isLeadTeacher,
      isClosedClass,
    });
  }

  async getClassAttendanceMatrix(
    actor: AuthenticatedUser,
    classId: string,
  ): Promise<ClassAttendanceMatrixDto> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        code: true,
        teacherId: true,
        totalSessions: true,
        course: { select: { name: true } },
      },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');

    this.policy.assertCanReadClassAttendance(actor, cls);

    const [sessions, enrollments, records, auditedEntries] = await Promise.all([
      this.prisma.lessonSession.findMany({
        where: { classId, status: { not: SessionStatus.CANCELLED } },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          sessionNumber: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          status: true,
          isMakeup: true,
          isRescheduled: true,
        },
      }),
      this.prisma.enrollment.findMany({
        where: { classId },
        include: {
          student: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ status: 'asc' }, { student: { fullName: 'asc' } }],
      }),
      this.prisma.attendanceRecord.findMany({
        where: { classId },
        select: { sessionId: true, studentId: true, status: true },
      }),
      this.prisma.attendanceAuditLog.findMany({
        where: { session: { classId } },
        select: { studentId: true, sessionId: true },
        distinct: ['studentId', 'sessionId'],
      }),
    ]);

    const now = new Date();
    const recordLookup = new Map<string, AttendanceStatus>();
    for (const r of records) {
      recordLookup.set(`${r.studentId}:${r.sessionId}`, r.status);
    }
    const editedRecordKeys = Array.from(
      new Set(auditedEntries.map((entry) => `${entry.studentId}:${entry.sessionId}`)),
    );

    const students = Array.from(groupByKey(enrollments, (e) => e.studentId).values()).map(
      (studentRows) => {
        const primary = selectPrimaryEnrollment(studentRows);
        const recordsBySessionId: Record<string, AttendanceStatus | null> = {};
        const eligibleRecords: Array<{ status: AttendanceStatus }> = [];

        for (const s of sessions) {
          const status = recordLookup.get(`${primary.studentId}:${s.id}`) ?? null;
          recordsBySessionId[s.id] = status;
          if (
            status !== null &&
            s.status === SessionStatus.COMPLETED &&
            studentRows.some((e) => this.policy.isStudentEligibleForSessionDate(e, s.sessionDate))
          ) {
            eligibleRecords.push({ status });
          }
        }

        return {
          studentId: primary.studentId,
          fullName: primary.student.fullName,
          email: primary.student.email,
          enrollmentStatus: primary.status,
          enrolledDate: formatIsoDateUtc(primary.enrolledDate),
          leftDate: primary.leftDate ? formatIsoDateUtc(primary.leftDate) : null,
          metrics: this.policy.computeStudentMetrics(eligibleRecords, cls.totalSessions),
          recordsBySessionId,
        };
      },
    );

    return {
      classId: cls.id,
      classCode: cls.code,
      courseName: cls.course.name,
      totalSessionsTarget: cls.totalSessions,
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionNumber: s.sessionNumber,
        sessionDate: formatIsoDateUtc(s.sessionDate),
        weekdayLabel: getWeekdayVnLabel(s.sessionDate),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        displayStatus: computeSessionDisplayStatus(s.status, s.sessionDate, now),
        isMakeup: s.isMakeup,
        isRescheduled: s.isRescheduled,
      })),
      students,
      editedRecordKeys,
    };
  }

  async getStudentMyAttendance(
    actor: AuthenticatedUser,
    query: GetMyAttendanceQueryDto = {},
  ): Promise<StudentMyAttendanceDto> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { studentId: actor.id },
      orderBy: [{ status: 'asc' }, { enrolledDate: 'desc' }],
      include: {
        class: {
          select: {
            id: true,
            code: true,
            totalSessions: true,
            course: { select: { name: true } },
            teacher: { select: { fullName: true } },
          },
        },
      },
    });

    const byClass = groupByKey(enrollments, (e) => e.classId);
    const uniqueEnrollments = Array.from(byClass.values()).map(selectPrimaryEnrollment);

    const classes = uniqueEnrollments.map((e) => ({
      classId: e.classId,
      classCode: e.class.code,
      courseName: e.class.course.name,
      enrollmentStatus: e.status,
    }));

    const selected = query.classId
      ? uniqueEnrollments.find((e) => e.classId === query.classId)
      : uniqueEnrollments[0];

    if (query.classId && !selected) {
      throw new ForbiddenException('Bạn không có quyền xem dữ liệu điểm danh của lớp học này');
    }

    if (!selected) {
      return { classes, activeClass: null, metrics: null, warningThresholdPercent: 30, sessions: [] };
    }

    const [sessions, myRecords] = await Promise.all([
      this.prisma.lessonSession.findMany({
        where: { classId: selected.classId },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          sessionNumber: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          status: true,
          isMakeup: true,
          isRescheduled: true,
          cancelReason: true,
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { classId: selected.classId, studentId: actor.id },
        select: { sessionId: true, status: true, note: true },
      }),
    ]);

    const recordMap = new Map(myRecords.map((r) => [r.sessionId, r]));
    const now = new Date();
    const eligibleRecords: Array<{ status: AttendanceStatus }> = [];

    const classIntervals = byClass.get(selected.classId) ?? [selected];

    const mappedSessions = sessions.map((s) => {
      const rec = recordMap.get(s.id);
      const isWithinEnrollment = classIntervals.some((e) =>
        this.policy.isStudentEligibleForSessionDate(e, s.sessionDate),
      );
      if (rec && s.status === SessionStatus.COMPLETED && isWithinEnrollment) {
        eligibleRecords.push({ status: rec.status });
      }
      return {
        id: s.id,
        sessionNumber: s.sessionNumber,
        sessionDate: formatIsoDateUtc(s.sessionDate),
        weekdayLabel: getWeekdayVnLabel(s.sessionDate),
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        displayStatus: computeSessionDisplayStatus(s.status, s.sessionDate, now),
        isMakeup: s.isMakeup,
        isRescheduled: s.isRescheduled,
        cancelReason: s.cancelReason,
        myStatus: rec?.status ?? null,
        myNote: rec?.note ?? null,
        isWithinEnrollment,
      };
    });

    return {
      classes,
      activeClass: {
        classId: selected.classId,
        classCode: selected.class.code,
        courseName: selected.class.course.name,
        teacherName: selected.class.teacher.fullName,
        totalSessions: selected.class.totalSessions,
        enrolledDate: formatIsoDateUtc(selected.enrolledDate),
        leftDate: selected.leftDate ? formatIsoDateUtc(selected.leftDate) : null,
      },
      metrics: this.policy.computeStudentMetrics(eligibleRecords, selected.class.totalSessions),
      warningThresholdPercent: 30,
      sessions: mappedSessions,
    };
  }
}
