import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, SessionChangeAction, SessionStatus, SessionType } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';
import {
  formatScheduleText,
  generateRecurringSessionDates,
  normalizeScheduleDays,
} from '../../classes/policies/class-schedule.util.js';
import { hasTimeRangeOverlap } from '../policies/session-schedule.policy.js';

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
   * when a class is created (`FUNC-026`, `FUNC-027`).
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
   * Regenerates only untouched `REGULAR` `SCHEDULED` sessions when recurring schedule rules change,
   * preserving `COMPLETED`, `CANCELLED`, `MANUAL`, `MAKEUP`, and `isRescheduled` sessions (`FUNC-027`).
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
      },
    });

    const removableIds = existingSessions
      .filter(
        (s) =>
          s.type === SessionType.REGULAR &&
          s.status === SessionStatus.SCHEDULED &&
          !s.isRescheduled &&
          !s.isMakeup,
      )
      .map((s) => s.id);

    if (removableIds.length > 0) {
      await tx.lessonSession.deleteMany({
        where: { id: { in: removableIds } },
      });
    }

    const preserved = existingSessions.filter((s) => !removableIds.includes(s.id));
    const preservedActive = preserved.filter((s) => s.status !== SessionStatus.CANCELLED);

    if (nextRule.totalSessions < preservedActive.length) {
      throw new BadRequestException(
        `Không thể giảm tổng số buổi xuống ${nextRule.totalSessions} vì đã có ${preservedActive.length} buổi học đã hoàn thành, đã đổi lịch hoặc học bù`,
      );
    }

    const needed = nextRule.totalSessions - preservedActive.length;
    if (needed > 0) {
      const candidateStartDate = this.resolveGenerationStartDate(nextRule.startDate, preservedActive);
      const dates = this.pickNonOverlappingDates(
        candidateStartDate,
        nextRule.scheduleDays,
        nextRule.scheduleStartTime,
        nextRule.scheduleEndTime,
        needed,
        preservedActive,
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
   * then syncs `classes.expected_end_date` to the final active session date (`DEC-031`).
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
    preservedActive: ReadonlyArray<{ sessionDate: Date; startTime: string; endTime: string }>,
  ): Date[] {
    const excludedYmds = new Set<string>();
    for (const s of preservedActive) {
      if (hasTimeRangeOverlap(startTime, endTime, s.startTime, s.endTime)) {
        excludedYmds.add(formatIsoDateUtc(s.sessionDate));
      }
    }
    return generateRecurringSessionDates(startDate, scheduleDays, needed, excludedYmds);
  }
}
