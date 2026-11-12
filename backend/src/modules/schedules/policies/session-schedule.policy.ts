import { BadRequestException, ConflictException } from '@nestjs/common';
import { ClassStatus, Prisma, SessionChangeAction, SessionStatus, SessionType } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { formatIsoDateUtc, resolveVnCalendarDateForDb, resolveVnToday } from '../../../common/utils/timezone.util.js';
import { assertValidTimeRange } from '../../classes/policies/class-schedule.util.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { SessionDisplayStatus } from '../schedules.types.js';

const WEEKDAY_VN_LABELS: Record<number, string> = {
  0: 'CN',
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
};

export function getWeekdayVnLabel(dateUtc: Date): string {
  return WEEKDAY_VN_LABELS[dateUtc.getUTCDay()] ?? '';
}

/**
 * Computes `displayStatus` per `DEC-009` and `04-lich-buoi-hoc.md`:
 * cancelled -> `CANCELLED`, attended -> `COMPLETED`, past -> `MISSED_ATTENDANCE`,
 * today -> `TODAY`, future -> `SCHEDULED`.
 */
export function computeSessionDisplayStatus(
  status: SessionStatus,
  sessionDateUtc: Date,
  nowInstant: Date = new Date(),
): SessionDisplayStatus {
  if (status === SessionStatus.CANCELLED) return 'CANCELLED';
  if (status === SessionStatus.COMPLETED) return 'COMPLETED';

  const todayYmd = formatIsoDateUtc(resolveVnToday(nowInstant));
  const sessionYmd = formatIsoDateUtc(sessionDateUtc);
  if (sessionYmd < todayYmd) return 'MISSED_ATTENDANCE';
  if (sessionYmd === todayYmd) return 'TODAY';
  return 'SCHEDULED';
}

export function hasTimeRangeOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function parseSessionCalendarDateOrThrow(rawDate: string, label = 'Ngày học'): Date {
  const parsed = resolveVnCalendarDateForDb(rawDate);
  if (!parsed) {
    throw new BadRequestException(`${label} không hợp lệ (YYYY-MM-DD)`);
  }
  return parsed;
}

export function assertSessionDateNotPastVn(
  dateUtc: Date,
  errorMessage = 'Không thể chọn ngày học trong quá khứ',
  nowInstant: Date = new Date(),
): void {
  const todayYmd = formatIsoDateUtc(resolveVnToday(nowInstant));
  if (formatIsoDateUtc(dateUtc) < todayYmd) {
    throw new BadRequestException(errorMessage);
  }
}

export async function assertNoSameClassSessionConflict(
  db: Prisma.TransactionClient | PrismaService,
  classId: string,
  sessionDate: Date,
  startTime: string,
  endTime: string,
  excludeSessionId?: string,
): Promise<void> {
  const sameDaySessions = await db.lessonSession.findMany({
    where: {
      classId,
      sessionDate,
      status: { not: SessionStatus.CANCELLED },
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    select: {
      id: true,
      sessionNumber: true,
      startTime: true,
      endTime: true,
    },
  });

  const clash = sameDaySessions.find((s) =>
    hasTimeRangeOverlap(startTime, endTime, s.startTime, s.endTime),
  );
  if (clash) {
    const label = clash.sessionNumber ? `Buổi ${clash.sessionNumber}` : 'buổi học khác';
    throw new ConflictException(
      `Trùng lịch với ${label} (${clash.startTime}–${clash.endTime} ngày ${formatIsoDateUtc(sessionDate)})`,
    );
  }
}

export async function findTeacherSessionConflictWarning(
  db: Prisma.TransactionClient | PrismaService,
  teacherId: string,
  excludeClassId: string,
  sessionDate: Date,
  startTime: string,
  endTime: string,
): Promise<string | null> {
  const otherSessions = await db.lessonSession.findMany({
    where: {
      sessionDate,
      status: { not: SessionStatus.CANCELLED },
      classId: { not: excludeClassId },
      class: {
        teacherId,
        status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
      },
    },
    select: {
      startTime: true,
      endTime: true,
      sessionNumber: true,
      class: { select: { code: true } },
    },
  });

  const conflicts = otherSessions.filter((s) =>
    hasTimeRangeOverlap(startTime, endTime, s.startTime, s.endTime),
  );
  if (conflicts.length === 0) return null;

  const summary = conflicts
    .map(
      (c) =>
        `${c.class.code} (${c.sessionNumber ? `Buổi ${c.sessionNumber} · ` : ''}${c.startTime}–${c.endTime})`,
    )
    .join(', ');
  return `Cảnh báo: Giáo viên đang có lịch dạy trùng giờ tại lớp ${summary}`;
}

export async function insertMakeupSessionInsideTx(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedUser,
  cancelledTarget: {
    id: string;
    classId: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    class: { teacherId: string };
  },
  slot: { sessionDate: string; startTime: string; endTime: string; topic?: string },
  customReason?: string,
): Promise<{ createdId: string; teacherWarning: string | null }> {
  const mDate = parseSessionCalendarDateOrThrow(slot.sessionDate, 'Ngày học bù');
  const { startTime, endTime } = assertValidTimeRange(slot.startTime, slot.endTime);

  await assertNoSameClassSessionConflict(tx, cancelledTarget.classId, mDate, startTime, endTime);
  const teacherWarning = await findTeacherSessionConflictWarning(
    tx,
    cancelledTarget.class.teacherId,
    cancelledTarget.classId,
    mDate,
    startTime,
    endTime,
  );

  const created = await tx.lessonSession.create({
    data: {
      classId: cancelledTarget.classId,
      sessionNumber: 200001,
      type: SessionType.MAKEUP,
      sessionDate: mDate,
      startTime,
      endTime,
      status: SessionStatus.SCHEDULED,
      isMakeup: true,
      makeupForSessionId: cancelledTarget.id,
      topic: slot.topic?.trim() || null,
    },
  });

  await tx.sessionChangeLog.create({
    data: {
      classId: cancelledTarget.classId,
      sessionId: created.id,
      action: SessionChangeAction.ADD_MAKEUP,
      actorId: actor.id,
      actorName: actor.fullName,
      previousDate: cancelledTarget.sessionDate,
      previousStartTime: cancelledTarget.startTime,
      previousEndTime: cancelledTarget.endTime,
      newDate: mDate,
      newStartTime: startTime,
      newEndTime: endTime,
      reason:
        customReason?.trim() ||
        `Tạo buổi học bù thay thế buổi hủy ngày ${formatIsoDateUtc(cancelledTarget.sessionDate)}`,
    },
  });

  return { createdId: created.id, teacherWarning };
}
