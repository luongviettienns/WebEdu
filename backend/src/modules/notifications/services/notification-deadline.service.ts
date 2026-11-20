import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  ClassStatus,
  EnrollmentStatus,
  NotificationType,
  SubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { DispatchNotificationInput } from '../notifications.types.js';
import { buildNotificationContent } from '../utils/notification-message.util.js';
import { NotificationDispatchService } from './notification-dispatch.service.js';

const REMINDER_SCAN_INTERVAL_MS = 15 * 60 * 1000;
const DUE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_THROTTLE_CACHE_ENTRIES = 2000;

@Injectable()
export class NotificationDeadlineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeadlineService.name);
  private readonly lastStudentCheckAt = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchService: NotificationDispatchService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dispatchDueSoonReminders().catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Scheduled due-soon reminder scan failed: ${reason}`);
      });
    }, REMINDER_SCAN_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async ensureDueSoonForStudentIfDue(
    studentId: string,
    minIntervalMs = 55_000,
  ): Promise<void> {
    const nowMs = Date.now();
    const lastCheck = this.lastStudentCheckAt.get(studentId) ?? 0;
    if (nowMs - lastCheck < minIntervalMs) {
      return;
    }
    if (this.lastStudentCheckAt.size >= MAX_THROTTLE_CACHE_ENTRIES) {
      const oldestKey = this.lastStudentCheckAt.keys().next().value;
      if (oldestKey !== undefined) {
        this.lastStudentCheckAt.delete(oldestKey);
      }
    }
    this.lastStudentCheckAt.set(studentId, nowMs);

    try {
      await this.dispatchDueSoonReminders(new Date(nowMs), studentId);
    } catch (err: unknown) {
      this.lastStudentCheckAt.delete(studentId);
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Student due-soon check failed for ${studentId}: ${reason}`);
    }
  }

  async dispatchDueSoonReminders(
    now: Date = new Date(),
    onlyStudentId?: string,
  ): Promise<number> {
    const windowEnd = new Date(now.getTime() + DUE_SOON_WINDOW_MS);
    const enrollmentFilter = {
      status: EnrollmentStatus.ACTIVE,
      ...(onlyStudentId ? { studentId: onlyStudentId } : {}),
    };

    const assignments = await this.prisma.classAssignment.findMany({
      where: {
        class: {
          status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
          ...(onlyStudentId ? { enrollments: { some: enrollmentFilter } } : {}),
        },
        OR: [
          { dueAt: { gt: now, lte: windowEnd } },
          {
            submissions: {
              some: {
                status: SubmissionStatus.IN_PROGRESS,
                dueAtOverride: { gt: now, lte: windowEnd },
                ...(onlyStudentId ? { studentId: onlyStudentId } : {}),
              },
            },
          },
        ],
      },
      select: {
        id: true,
        dueAt: true,
        assessment: { select: { title: true } },
        class: {
          select: {
            enrollments: {
              where: enrollmentFilter,
              select: { studentId: true },
            },
          },
        },
        submissions: {
          where: {
            status: { not: SubmissionStatus.SUPERSEDED },
            ...(onlyStudentId ? { studentId: onlyStudentId } : {}),
          },
          select: {
            studentId: true,
            status: true,
            dueAtOverride: true,
          },
        },
      },
    });

    const inputs: DispatchNotificationInput[] = [];
    for (const assignment of assignments) {
      const submissionByStudent = new Map(
        assignment.submissions.map((sub) => [sub.studentId, sub]),
      );

      for (const enrollment of assignment.class.enrollments) {
        const activeSub = submissionByStudent.get(enrollment.studentId);
        if (activeSub && activeSub.status !== SubmissionStatus.IN_PROGRESS) {
          continue;
        }
        const effectiveDueAt = activeSub?.dueAtOverride ?? assignment.dueAt;
        if (
          effectiveDueAt.getTime() <= now.getTime() ||
          effectiveDueAt.getTime() > windowEnd.getTime()
        ) {
          continue;
        }

        const copy = buildNotificationContent({
          type: NotificationType.ASSIGNMENT_DUE_SOON,
          assessmentTitle: assignment.assessment.title,
          dueAt: effectiveDueAt,
        });
        inputs.push({
          recipientId: enrollment.studentId,
          type: NotificationType.ASSIGNMENT_DUE_SOON,
          title: copy.title,
          body: copy.body,
          linkPath: `/student/assignments/${assignment.id}`,
          dedupKey: `due_soon:${assignment.id}:${effectiveDueAt.getTime()}`,
        });
      }
    }

    if (inputs.length === 0) {
      return 0;
    }

    const recipientIds = [...new Set(inputs.map((item) => item.recipientId))];
    const dedupKeys = [
      ...new Set(inputs.map((item) => item.dedupKey).filter((k): k is string => Boolean(k))),
    ];
    const existing =
      dedupKeys.length > 0 && typeof this.prisma.notification?.findMany === 'function'
        ? await this.prisma.notification.findMany({
            where: {
              recipientId: { in: recipientIds },
              dedupKey: { in: dedupKeys },
            },
            select: { recipientId: true, dedupKey: true },
          })
        : [];
    const existingPairs = new Set(existing.map((row) => `${row.recipientId}:${row.dedupKey}`));
    const pendingInputs = inputs.filter(
      (item) => !item.dedupKey || !existingPairs.has(`${item.recipientId}:${item.dedupKey}`),
    );
    if (pendingInputs.length === 0) {
      return 0;
    }

    return this.prisma.$transaction((tx) =>
      this.dispatchService.dispatchManyTx(tx, pendingInputs),
    );
  }
}
