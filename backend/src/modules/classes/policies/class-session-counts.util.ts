import { Prisma, SessionChangeAction, SessionStatus } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { formatIsoDateUtc, resolveVnToday } from '../../../common/utils/timezone.util.js';
import { getWeekdayVnLabel } from '../../schedules/policies/session-schedule.policy.js';
import type { ClassNextSessionDto } from '../classes.types.js';

export const AUTO_CANCEL_ON_COMPLETE_REASON = 'Tự động hủy khi kết thúc lớp';
export const RESTORE_ON_REOPEN_REASON = 'Khôi phục buổi học khi mở lại lớp';

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

  // Partial unique index lesson_sessions_class_active_num_unique ignores session_number >= 200000.
  await tx.lessonSession.updateMany({
    where: { id: { in: autoCancelled.map((s) => s.id) } },
    data: {
      status: SessionStatus.SCHEDULED,
      sessionNumber: 200001,
      cancelReason: null,
      cancelledById: null,
      cancelledAt: null,
    },
  });

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

function toClassCountMap(
  rows: ReadonlyArray<{ classId: string; _count: { _all: number } }>,
): Map<string, number> {
  return new Map(rows.map((row) => [row.classId, row._count._all]));
}

export async function getCompletedSessionsCountMap(
  db: Prisma.TransactionClient | PrismaService,
  classIds: string[],
): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const rows = await db.lessonSession.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds }, status: SessionStatus.COMPLETED },
    _count: { _all: true },
  });
  return toClassCountMap(rows);
}

export async function getAttendanceRecordsCountMap(
  db: Prisma.TransactionClient | PrismaService,
  classIds: string[],
): Promise<Map<string, number>> {
  if (classIds.length === 0) return new Map();
  const rows = await db.attendanceRecord.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds } },
    _count: { _all: true },
  });
  return toClassCountMap(rows);
}

const NEXT_SESSION_SELECT = {
  id: true,
  classId: true,
  sessionNumber: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  isMakeup: true,
} satisfies Prisma.LessonSessionSelect;

export function toClassNextSessionDto(session: {
  id: string;
  sessionNumber: number | null;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  isMakeup?: boolean;
}): ClassNextSessionDto {
  return {
    id: session.id,
    sessionNumber: session.sessionNumber ?? null,
    sessionDate: formatIsoDateUtc(session.sessionDate),
    weekdayLabel: getWeekdayVnLabel(session.sessionDate),
    startTime: session.startTime,
    endTime: session.endTime,
    isMakeup: Boolean(session.isMakeup),
  };
}

export async function getNextSessionMap(
  db: Prisma.TransactionClient | PrismaService,
  classIds: string[],
  nowInstant: Date = new Date(),
): Promise<Map<string, ClassNextSessionDto>> {
  if (classIds.length === 0) return new Map();
  const rows = await db.lessonSession.findMany({
    where: {
      classId: { in: classIds },
      status: SessionStatus.SCHEDULED,
      sessionDate: { gte: resolveVnToday(nowInstant) },
    },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    select: NEXT_SESSION_SELECT,
  });
  const map = new Map<string, ClassNextSessionDto>();
  for (const row of rows) {
    if (!map.has(row.classId)) {
      map.set(row.classId, toClassNextSessionDto(row));
    }
  }
  return map;
}

export async function findNextScheduledSession(
  db: Prisma.TransactionClient | PrismaService,
  classId: string,
  nowInstant: Date = new Date(),
): Promise<ClassNextSessionDto | null> {
  const row = await db.lessonSession.findFirst({
    where: {
      classId,
      status: SessionStatus.SCHEDULED,
      sessionDate: { gte: resolveVnToday(nowInstant) },
    },
    orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    select: NEXT_SESSION_SELECT,
  });
  return row ? toClassNextSessionDto(row) : null;
}
