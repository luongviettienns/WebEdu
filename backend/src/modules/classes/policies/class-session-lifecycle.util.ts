import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ClassStatus,
  Prisma,
  Role,
  SessionChangeAction,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import {
  assertValidTimeRange,
  buildScheduleConflictWarning,
  calculateExpectedEndDate,
  normalizeScheduleDays,
  parseRequiredCalendarDate,
  type ClassScheduleSlice,
} from './class-schedule.util.js';

export const AUTO_CANCEL_ON_COMPLETE_REASON = 'Tự động hủy khi kết thúc lớp';
export const RESTORE_ON_REOPEN_REASON = 'Khôi phục buổi học khi mở lại lớp';

export async function findTeacherScheduleConflictWarning(
  db: Prisma.TransactionClient | PrismaService,
  teacherId: string,
  candidate: ClassScheduleSlice,
  excludeClassId?: string,
): Promise<string | null> {
  const others = await db.class.findMany({
    where: {
      teacherId,
      ...(excludeClassId ? { id: { not: excludeClassId } } : {}),
      status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
    },
    select: {
      code: true,
      scheduleDays: true,
      scheduleStartTime: true,
      scheduleEndTime: true,
      startDate: true,
      expectedEndDate: true,
      actualEndDate: true,
    },
  });
  return buildScheduleConflictWarning(
    candidate,
    others.map(({ actualEndDate, expectedEndDate, ...rest }) => ({
      ...rest,
      endDate: actualEndDate ?? expectedEndDate,
    })),
  );
}

export function resolveUpdatedClassSchedule(
  existing: {
    scheduleDays: number[];
    scheduleStartTime: string;
    scheduleEndTime: string;
    startDate: Date;
    totalSessions: number;
    status: ClassStatus;
    notes: string | null;
  },
  dto: {
    scheduleDays?: number[];
    scheduleStartTime?: string;
    scheduleEndTime?: string;
    startDate?: string;
    totalSessions?: number;
    status?: ClassStatus;
    notes?: string | null;
  },
  validateSessions: (value: number) => number,
) {
  const nextScheduleDays =
    dto.scheduleDays !== undefined
      ? normalizeScheduleDays(dto.scheduleDays)
      : existing.scheduleDays;
  const { startTime: nextStartTime, endTime: nextEndTime } = assertValidTimeRange(
    dto.scheduleStartTime ?? existing.scheduleStartTime,
    dto.scheduleEndTime ?? existing.scheduleEndTime,
  );
  const nextStartDate =
    dto.startDate !== undefined
      ? parseRequiredCalendarDate(dto.startDate, 'Ngày khai giảng không hợp lệ')
      : existing.startDate;
  const nextTotalSessions =
    dto.totalSessions !== undefined
      ? validateSessions(dto.totalSessions)
      : existing.totalSessions;
  const nextExpectedEndDate = calculateExpectedEndDate(
    nextStartDate,
    nextScheduleDays,
    nextTotalSessions,
  );
  return {
    nextScheduleDays,
    nextStartTime,
    nextEndTime,
    nextStartDate,
    nextTotalSessions,
    nextExpectedEndDate,
    nextStatus: dto.status ?? existing.status,
    nextNotes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
  };
}

export async function assertValidActiveCourseInDb(
  db: Prisma.TransactionClient | PrismaService,
  courseId: string,
): Promise<{ id: string; defaultSessions: number | null }> {
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course) throw new NotFoundException('Không tìm thấy khóa học');
  if (!course.isActive) {
    throw new BadRequestException('Khóa học đã ngừng sử dụng, không thể mở lớp mới');
  }
  return course;
}

export async function assertValidActiveTeacherInDb(
  db: Prisma.TransactionClient | PrismaService,
  teacherId: string,
): Promise<void> {
  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { id: true, roles: true, status: true },
  });
  if (!teacher || !teacher.roles.includes(Role.TEACHER) || teacher.status !== UserStatus.ACTIVE) {
    throw new BadRequestException('Giáo viên phụ trách không hợp lệ hoặc đã ngừng hoạt động');
  }
}

export async function getClassMutabilityCountsInTx(
  tx: Prisma.TransactionClient,
  classId: string,
): Promise<{ completedSessionsCount: number; attendanceRecordsCount: number; isStartDateLocked: boolean }> {
  const [completedSessionsCount, attendanceRecordsCount] = await Promise.all([
    tx.lessonSession.count({ where: { classId, status: SessionStatus.COMPLETED } }),
    tx.attendanceRecord.count({ where: { classId } }),
  ]);
  return {
    completedSessionsCount,
    attendanceRecordsCount,
    isStartDateLocked: completedSessionsCount > 0 || attendanceRecordsCount > 0,
  };
}

export async function assertStartDateMutableInTx(
  tx: Prisma.TransactionClient,
  classId: string,
): Promise<void> {
  const { completedSessionsCount, attendanceRecordsCount } =
    await getClassMutabilityCountsInTx(tx, classId);
  if (completedSessionsCount > 0 || attendanceRecordsCount > 0) {
    throw new BadRequestException(
      'Không thể thay đổi ngày khai giảng khi lớp đã có buổi học hoàn thành hoặc đã có dữ liệu điểm danh',
    );
  }
}

export function computeStudentAbsencesMap(
  enrollments: ReadonlyArray<{ studentId: string; enrolledDate: Date; leftDate: Date | null }>,
  absenceRecords: ReadonlyArray<{ studentId: string; session: { sessionDate: Date } }>,
): Map<string, number> {
  const rangesByStudent = new Map<string, Array<{ enrolledDate: Date; leftDate: Date | null }>>();
  for (const enr of enrollments) {
    const list = rangesByStudent.get(enr.studentId) ?? [];
    list.push({ enrolledDate: enr.enrolledDate, leftDate: enr.leftDate });
    rangesByStudent.set(enr.studentId, list);
  }

  const absencesByStudentId = new Map<string, number>();
  for (const r of absenceRecords) {
    const sTime = r.session.sessionDate.getTime();
    const ranges = rangesByStudent.get(r.studentId) ?? [];
    const eligible = ranges.some(
      (e) =>
        e.enrolledDate.getTime() <= sTime &&
        (e.leftDate === null || e.leftDate.getTime() >= sTime),
    );
    if (eligible) {
      absencesByStudentId.set(r.studentId, (absencesByStudentId.get(r.studentId) ?? 0) + 1);
    }
  }
  return absencesByStudentId;
}

export async function cancelScheduledSessionsOnCompleteInTx(
  tx: Prisma.TransactionClient,
  classId: string,
  actor: Pick<AuthenticatedUser, 'id' | 'fullName'>,
  cancelAt: Date = new Date(),
): Promise<number> {
  const scheduled = await tx.lessonSession.findMany({
    where: { classId, status: SessionStatus.SCHEDULED },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, sessionDate: true, startTime: true, endTime: true },
  });
  if (scheduled.length === 0) return 0;

  await tx.lessonSession.updateMany({
    where: { id: { in: scheduled.map((s) => s.id) }, status: SessionStatus.SCHEDULED },
    data: {
      status: SessionStatus.CANCELLED,
      sessionNumber: null,
      cancelReason: AUTO_CANCEL_ON_COMPLETE_REASON,
      cancelledById: actor.id,
      cancelledAt: cancelAt,
    },
  });

  await tx.sessionChangeLog.createMany({
    data: scheduled.map((s) => ({
      classId,
      sessionId: s.id,
      action: SessionChangeAction.CANCEL,
      actorId: actor.id,
      actorName: actor.fullName,
      previousDate: s.sessionDate,
      previousStartTime: s.startTime,
      previousEndTime: s.endTime,
      reason: AUTO_CANCEL_ON_COMPLETE_REASON,
    })),
  });
  return scheduled.length;
}

export async function restoreAutoCancelledSessionsOnReopenInTx(
  tx: Prisma.TransactionClient,
  classId: string,
  actor: Pick<AuthenticatedUser, 'id' | 'fullName'>,
  renumberAndSyncFn?: (tx: Prisma.TransactionClient, classId: string) => Promise<unknown>,
): Promise<number> {
  const autoCancelled = await tx.lessonSession.findMany({
    where: {
      classId,
      status: SessionStatus.CANCELLED,
      cancelReason: AUTO_CANCEL_ON_COMPLETE_REASON,
      makeupReplacement: { is: null },
    },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, sessionDate: true, startTime: true, endTime: true },
  });
  if (autoCancelled.length === 0) return 0;

  for (const [idx, s] of autoCancelled.entries()) {
    await tx.lessonSession.update({
      where: { id: s.id },
      data: {
        status: SessionStatus.SCHEDULED,
        sessionNumber: 200001 + idx,
        cancelReason: null,
        cancelledById: null,
        cancelledAt: null,
      },
    });
  }

  await tx.sessionChangeLog.createMany({
    data: autoCancelled.map((s) => ({
      classId,
      sessionId: s.id,
      action: SessionChangeAction.GENERATE,
      actorId: actor.id,
      actorName: actor.fullName,
      newDate: s.sessionDate,
      newStartTime: s.startTime,
      newEndTime: s.endTime,
      reason: RESTORE_ON_REOPEN_REASON,
    })),
  });

  if (renumberAndSyncFn) {
    await renumberAndSyncFn(tx, classId);
  }
  return autoCancelled.length;
}
