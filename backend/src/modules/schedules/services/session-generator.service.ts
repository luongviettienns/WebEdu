import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, SessionChangeAction, SessionStatus, SessionType } from '@prisma/client';
import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { formatIsoDateUtc, resolveVnToday, VN_TIMEZONE } from '../../../common/utils/timezone.util.js';
import {
  formatScheduleText,
  generateRecurringSessionDates,
  normalizeScheduleDays,
} from '../../classes/policies/class-schedule.util.js';
import { hasTimeRangeOverlap } from '../policies/session-schedule.policy.js';

const RULE_REPLACEMENT_REASON = 'Thay thế theo lịch định kỳ mới';

export interface ClassScheduleRuleSnapshot {
  startDate: Date;
  scheduleDays: readonly number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  totalSessions: number;
  expectedEndDate: Date | null;
}

@Injectable()
export class SessionGeneratorService {
  /**
   * Generates `1..totalSessions` `REGULAR` `SCHEDULED` sessions inside the caller's transaction
   * when a class is created.
   */
  async generateInitialSessionsForClass(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    cls: {
      id: string;
      code: string;
      startDate: Date;
      scheduleDays: readonly number[];
      scheduleStartTime: string;
      scheduleEndTime: string;
      totalSessions: number;
    },
  ): Promise<Date> {
    const dates = generateRecurringSessionDates(
      cls.startDate,
      cls.scheduleDays,
      cls.totalSessions,
    );

    await tx.lessonSession.createMany({
      data: dates.map((sessionDate, idx) => ({
        classId: cls.id,
        sessionNumber: idx + 1,
        type: SessionType.REGULAR,
        sessionDate,
        startTime: cls.scheduleStartTime,
        endTime: cls.scheduleEndTime,
        status: SessionStatus.SCHEDULED,
      })),
    });

    await tx.sessionChangeLog.create({
      data: {
        classId: cls.id,
        action: SessionChangeAction.GENERATE,
        actorId: actor.id,
        actorName: actor.fullName,
        newDate: cls.startDate,
        newStartTime: cls.scheduleStartTime,
        newEndTime: cls.scheduleEndTime,
        reason: `Khởi tạo ${dates.length} buổi học định kỳ cho lớp ${cls.code} (${formatScheduleText(cls.scheduleDays, cls.scheduleStartTime, cls.scheduleEndTime)})`,
      },
    });

    return dates[dates.length - 1]!;
  }

  /**
   * Replaces eligible future sessions after a recurring rule change.
   * Retains past sessions and cancels linked replacements so their records stay accessible.
   */
  async reconcileRecurringSessionsAfterRuleUpdate(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    params: {
      classId: string;
      classCode: string;
      previousRule: ClassScheduleRuleSnapshot;
      nextRule: Omit<ClassScheduleRuleSnapshot, 'expectedEndDate'>;
      reason?: string;
      now?: Date;
    },
  ): Promise<{ expectedEndDate: Date | null; regeneratedCount: number }> {
    const { classId, classCode, previousRule, nextRule } = params;
    if (!this.didRecurringRuleChange(previousRule, nextRule)) {
      return { expectedEndDate: previousRule.expectedEndDate, regeneratedCount: 0 };
    }

    await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${classId} FOR UPDATE`;

    const existingSessions = await tx.lessonSession.findMany({
      where: { classId },
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        type: true,
        status: true,
        sessionDate: true,
        startTime: true,
        endTime: true,
        isRescheduled: true,
        isMakeup: true,
        cancelReason: true,
        makeupReplacement: { select: { id: true } },
        _count: { select: {
          changeLogs: true, classAssignments: true, attendanceRecords: true, attendanceAudits: true,
        } },
      },
    });

    const now = params.now ?? new Date();
    const today = resolveVnToday(now);
    const localTime = formatInTimeZone(now, VN_TIMEZONE, 'HH:mm');
    const replaceable = existingSessions.filter((session) =>
      (session.sessionDate > today ||
        (session.sessionDate.getTime() === today.getTime() && session.startTime > localTime)) &&
      session.type === SessionType.REGULAR &&
      session.status === SessionStatus.SCHEDULED &&
      !session.isRescheduled && !session.isMakeup &&
      !session._count.attendanceRecords && !session._count.attendanceAudits &&
      !session.makeupReplacement,
    );
    const retired = replaceable.filter((session) =>
      session._count.changeLogs > 0 || session._count.classAssignments > 0,
    );
    const retiredIds = new Set(retired.map(({ id }) => id));
    const removableIds = replaceable.filter(({ id }) => !retiredIds.has(id)).map(({ id }) => id);
    if (removableIds.length > 0) {
      await tx.lessonSession.deleteMany({ where: { id: { in: removableIds } } });
    }
    if (retired.length > 0) {
      await tx.lessonSession.updateMany({
        where: { id: { in: [...retiredIds] } },
        data: { status: SessionStatus.CANCELLED, sessionNumber: null,
          cancelReason: RULE_REPLACEMENT_REASON, cancelledById: actor.id, cancelledAt: now },
      });
      await tx.sessionChangeLog.createMany({
        data: retired.map((session) => ({
          classId, sessionId: session.id, action: SessionChangeAction.CANCEL,
          actorId: actor.id, actorName: actor.fullName, previousDate: session.sessionDate,
          previousStartTime: session.startTime, previousEndTime: session.endTime,
          reason: RULE_REPLACEMENT_REASON,
        })),
      });
    }

    const replacedIds = new Set(replaceable.map(({ id }) => id));
    const preserved = existingSessions.filter((session) => !replacedIds.has(session.id));
    const preservedActive = preserved.filter((s) => s.status !== SessionStatus.CANCELLED);

    if (nextRule.totalSessions < preservedActive.length) {
      throw new BadRequestException(
        `Không thể giảm tổng số buổi xuống ${nextRule.totalSessions} vì đã có ${preservedActive.length} buổi học đã hoàn thành, đã đổi lịch hoặc học bù`,
      );
    }

    const needed = nextRule.totalSessions - preservedActive.length;
    if (needed > 0) {
      const firstFutureDay = nextRule.scheduleStartTime > localTime ? today : addDays(today, 1);
      const candidateStartDate = this.resolveGenerationStartDate(
        nextRule.startDate < firstFutureDay ? firstFutureDay : nextRule.startDate, preservedActive,
      );
      const dates = this.pickNonOverlappingDates(
        candidateStartDate,
        nextRule.scheduleDays,
        nextRule.scheduleStartTime,
        nextRule.scheduleEndTime,
        needed,
        preserved,
      );

      await tx.lessonSession.createMany({
        data: dates.map((sessionDate, idx) => ({
          classId,
          sessionNumber: 200001 + idx,
          type: SessionType.REGULAR,
          sessionDate,
          startTime: nextRule.scheduleStartTime,
          endTime: nextRule.scheduleEndTime,
          status: SessionStatus.SCHEDULED,
        })),
      });
    }

    const expectedEndDate = await this.renumberActiveSessionsAndSyncExpectedEndDate(tx, classId);

    const prevText = formatScheduleText(
      previousRule.scheduleDays,
      previousRule.scheduleStartTime,
      previousRule.scheduleEndTime,
    );
    const nextText = formatScheduleText(
      nextRule.scheduleDays,
      nextRule.scheduleStartTime,
      nextRule.scheduleEndTime,
    );

    await tx.sessionChangeLog.create({
      data: {
        classId,
        action: SessionChangeAction.UPDATE_RECURRING_RULE,
        actorId: actor.id,
        actorName: actor.fullName,
        previousDate: previousRule.startDate,
        previousStartTime: previousRule.scheduleStartTime,
        previousEndTime: previousRule.scheduleEndTime,
        newDate: nextRule.startDate,
        newStartTime: nextRule.scheduleStartTime,
        newEndTime: nextRule.scheduleEndTime,
        reason:
          params.reason?.trim() ||
          `Cập nhật lịch định kỳ lớp ${classCode}: ${prevText} (${previousRule.totalSessions} buổi) → ${nextText} (${nextRule.totalSessions} buổi)`,
      },
    });

    return { expectedEndDate, regeneratedCount: needed };
  }

  /**
   * Atomically renumbers all non-cancelled sessions `1..N` (`sessionDate ASC, startTime ASC, createdAt ASC`)
   * without violating partial unique index `lesson_sessions_class_active_num_unique`,
   * then syncs `classes.expected_end_date` to the final active session date.
   */
  async renumberActiveSessionsAndSyncExpectedEndDate(
    tx: Prisma.TransactionClient,
    classId: string,
  ): Promise<Date | null> {
    await tx.$executeRaw`
      UPDATE "lesson_sessions"
      SET "session_number" = "session_number" + 100000
      WHERE "class_id" = ${classId}
        AND "status" <> 'CANCELLED'::"SessionStatus"
        AND "session_number" IS NOT NULL
        AND "session_number" < 100000
    `;

    await tx.$executeRaw`
      WITH ranked AS (
        SELECT "id", ROW_NUMBER() OVER (
          ORDER BY "session_date" ASC, "start_time" ASC, "created_at" ASC, "id" ASC
        ) AS rn
        FROM "lesson_sessions"
        WHERE "class_id" = ${classId}
          AND "status" <> 'CANCELLED'::"SessionStatus"
      )
      UPDATE "lesson_sessions" ls
      SET "session_number" = ranked.rn::integer,
          "updated_at" = CURRENT_TIMESTAMP
      FROM ranked
      WHERE ls."id" = ranked."id"
    `;

    const lastActive = await tx.lessonSession.findFirst({
      where: { classId, status: { not: SessionStatus.CANCELLED } },
      orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }],
      select: { sessionDate: true },
    });

    const expectedEndDate = lastActive?.sessionDate ?? null;
    await tx.class.update({
      where: { id: classId },
      data: { expectedEndDate },
    });
    return expectedEndDate;
  }

  private didRecurringRuleChange(
    prev: ClassScheduleRuleSnapshot,
    next: Omit<ClassScheduleRuleSnapshot, 'expectedEndDate'>,
  ): boolean {
    const prevDays = normalizeScheduleDays(prev.scheduleDays).join(',');
    const nextDays = normalizeScheduleDays(next.scheduleDays).join(',');
    return (
      prevDays !== nextDays ||
      prev.scheduleStartTime !== next.scheduleStartTime ||
      prev.scheduleEndTime !== next.scheduleEndTime ||
      formatIsoDateUtc(prev.startDate) !== formatIsoDateUtc(next.startDate) ||
      prev.totalSessions !== next.totalSessions
    );
  }

  private resolveGenerationStartDate(
    ruleStartDate: Date,
    preservedActive: ReadonlyArray<{ status: SessionStatus; sessionDate: Date }>,
  ): Date {
    const completedDates = preservedActive
      .filter((s) => s.status === SessionStatus.COMPLETED)
      .map((s) => s.sessionDate.getTime());
    if (completedDates.length === 0) return ruleStartDate;

    const latestCompletedMs = Math.max(...completedDates);
    const dayAfterCompleted = new Date(latestCompletedMs + 24 * 60 * 60 * 1000);
    return dayAfterCompleted.getTime() > ruleStartDate.getTime() ? dayAfterCompleted : ruleStartDate;
  }

  private pickNonOverlappingDates(
    startDate: Date,
    scheduleDays: readonly number[],
    startTime: string,
    endTime: string,
    needed: number,
    preserved: ReadonlyArray<{ sessionDate: Date; startTime: string; endTime: string; status: SessionStatus; cancelReason: string | null }>,
  ): Date[] {
    const excludedYmds = new Set<string>();
    for (const s of preserved) {
      const blocksDate = s.status === SessionStatus.CANCELLED
        ? s.cancelReason !== RULE_REPLACEMENT_REASON
        : hasTimeRangeOverlap(startTime, endTime, s.startTime, s.endTime);
      if (blocksDate) {
        excludedYmds.add(formatIsoDateUtc(s.sessionDate));
      }
    }
    return generateRecurringSessionDates(startDate, scheduleDays, needed, excludedYmds);
  }
}
