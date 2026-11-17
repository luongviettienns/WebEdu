import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { resolveVnToday } from '../../../common/utils/timezone.util.js';
import type { DbClient } from '../../assignments/policies/assignment-access.policy.js';
import { SUBMIT_GRACE_MS } from '../../assignments/services/submission-session.util.js';
import type { tickSubmissionTimer } from '../../assignments/services/submission-timer.util.js';
import type { GradingTrackerStatusFilter, GradingTrackerSummaryDto } from '../grading.types.js';

interface TrackerPage extends GradingTrackerSummaryDto {
  total: number;
  rows: Array<{ studentId: string; fullName: string; email: string; overdue: boolean }>;
}

type ExpiredTrackerDraft = Parameters<typeof tickSubmissionTimer>[0] & { id: string; dueAtOverride: Date | null };

export function findExpiredTrackerDrafts(
  db: DbClient,
  assignment: { id: string; dueAt: Date; effectiveDurationMinutes: number | null },
  now: Date,
  lockForUpdate: boolean,
): Promise<ExpiredTrackerDraft[]> {
  const cutoff = new Date(now.getTime() - SUBMIT_GRACE_MS);
  const durationSeconds = assignment.effectiveDurationMinutes === null ? null : assignment.effectiveDurationMinutes * 60;
  return db.$queryRaw<ExpiredTrackerDraft[]>`
    SELECT id, elapsed_seconds AS "elapsedSeconds", remaining_seconds AS "remainingSeconds",
      due_at_override AS "dueAtOverride", timer_accounted_at AS "timerAccountedAt",
      timer_lease_until AS "timerLeaseUntil", timer_client_id AS "timerClientId"
    FROM submissions
    WHERE class_assignment_id = ${assignment.id} AND status = 'IN_PROGRESS'
      AND (COALESCE(due_at_override, ${assignment.dueAt}::timestamptz) < ${cutoff}::timestamptz
        OR (${durationSeconds}::int IS NOT NULL AND (
          remaining_seconds <= 0 OR (
            timer_accounted_at IS NOT NULL AND timer_lease_until IS NOT NULL
            AND COALESCE(remaining_seconds, ${durationSeconds}::int) * INTERVAL '1 second'
              <= LEAST(${now}::timestamptz, timer_lease_until) - timer_accounted_at
          )
        )))
    ORDER BY id
    ${lockForUpdate ? Prisma.sql`FOR UPDATE` : Prisma.sql`LIMIT 1`}
  `;
}

const FILTERS = {
  ALL: Prisma.sql`TRUE`,
  NEEDS_GRADING: Prisma.sql`status IN ('SUBMITTED_WAITING', 'AUTO_GRADED_PENDING_REVIEW')`,
  CONFIRMED: Prisma.sql`status = 'GRADED'`,
  PUBLISHED: Prisma.sql`status = 'RETURNED'`,
  OVERDUE_NOT_SUBMITTED: Prisma.sql`overdue`,
  NOT_STARTED: Prisma.sql`status IS NULL`,
  IN_PROGRESS: Prisma.sql`status = 'IN_PROGRESS'`,
} satisfies Record<GradingTrackerStatusFilter, Prisma.Sql>;

export async function findTrackerPage(
  db: PrismaService,
  assignment: { id: string; classId: string; assignedAt: Date; dueAt: Date },
  now: Date,
  filter: GradingTrackerStatusFilter,
  skip: number,
  limit: number,
): Promise<TrackerPage> {
  const dueDate = resolveVnToday(assignment.dueAt).toISOString().slice(0, 10);
  const assignedDate = resolveVnToday(assignment.assignedAt).toISOString().slice(0, 10);
  const [row] = await db.$queryRaw<TrackerPage[]>`
    WITH roster AS (
      SELECT student_id, MIN(enrolled_date) AS first_enrollment,
        BOOL_OR(enrolled_date <= ${dueDate}::date AND (left_date IS NULL OR left_date >= ${assignedDate}::date)) AS eligible
      FROM enrollments
      WHERE class_id = ${assignment.classId} AND status IN ('ACTIVE', 'COMPLETED')
      GROUP BY student_id
    ), tracker AS (
      SELECT r.student_id, r.first_enrollment, s.status,
        s.id IS NULL AND r.eligible AND ${now}::timestamptz > ${assignment.dueAt}::timestamptz
        AND NOT EXISTS (
          SELECT 1 FROM submissions prior
          WHERE prior.student_id = r.student_id AND prior.class_assignment_id = ${assignment.id}
        ) AS overdue
      FROM roster r
      LEFT JOIN submissions s ON s.student_id = r.student_id
        AND s.class_assignment_id = ${assignment.id} AND s.status <> 'SUPERSEDED'
    ), page AS (
      SELECT t.student_id, t.first_enrollment, t.overdue, u.full_name, u.email
      FROM (
        SELECT * FROM tracker WHERE ${FILTERS[filter]}
        ORDER BY first_enrollment, student_id OFFSET ${skip} LIMIT ${limit}
      ) t JOIN users u ON u.id = t.student_id
    )
    SELECT COUNT(*)::int AS "totalStudents",
      COUNT(*) FILTER (WHERE status IS NULL)::int AS "notStartedCount",
      COUNT(*) FILTER (WHERE overdue)::int AS "overdueNotSubmittedCount",
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS "inProgressCount",
      COUNT(*) FILTER (WHERE status = 'SUBMITTED_WAITING')::int AS "submittedWaitingCount",
      COUNT(*) FILTER (WHERE status = 'AUTO_GRADED_PENDING_REVIEW')::int AS "autoGradedPendingReviewCount",
      COUNT(*) FILTER (WHERE status = 'GRADED')::int AS "gradedConfirmedCount",
      COUNT(*) FILTER (WHERE status = 'RETURNED')::int AS "returnedPublishedCount",
      COUNT(*) FILTER (WHERE status = 'GRADED')::int AS "readyToPublishCount",
      COUNT(*) FILTER (WHERE ${FILTERS[filter]})::int AS total,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'studentId', student_id, 'fullName', full_name, 'email', email, 'overdue', overdue
      ) ORDER BY first_enrollment, student_id) FROM page), '[]'::jsonb) AS rows
    FROM tracker
  `;
  return row!;
}
