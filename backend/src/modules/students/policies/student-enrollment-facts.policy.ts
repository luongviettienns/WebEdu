import { EnrollmentStatus, type Prisma } from '@prisma/client';

export interface EnrollmentFacts {
  /** The student has at least one ACTIVE/COMPLETED enrollment (or a current class). */
  hasActiveOrCompletedEnrollment: boolean;
  /** The student has ever been placed in a class (enrollment history or profile trace). */
  hasEverBeenEnrolled: boolean;
}

interface EnrollmentTraceProfile {
  currentClassId?: string | null;
  enrolledAt?: Date | null;
  assignedClass?: string | null;
}

/**
 * Derives the enrollment facts that gate FUNC-008 status transitions
 * (no PENDING_CLASS -> ACTIVE bypass, no re-queueing an enrolled student,
 * no reactivating a dropped pure student without a valid enrollment).
 *
 * Must run inside the caller's transaction, after the student row is locked.
 * Shared by StudentCrudService and SystemSettingsService so both enforce the
 * identical rule. Falls back to profile traces when the Enrollment delegate is
 * unavailable (lightweight unit-test doubles).
 */
export async function loadEnrollmentFacts(
  tx: Prisma.TransactionClient,
  studentId: string,
  profile: EnrollmentTraceProfile | null | undefined,
): Promise<EnrollmentFacts> {
  const validEnrollmentCount = tx.enrollment?.count
    ? await tx.enrollment.count({
        where: {
          studentId,
          status: {
            in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED],
          },
        },
      })
    : null;

  const hasProfileTrace = Boolean(
    profile?.enrolledAt || profile?.currentClassId || profile?.assignedClass,
  );

  const hasActiveOrCompletedEnrollment =
    validEnrollmentCount !== null
      ? validEnrollmentCount > 0 || Boolean(profile?.currentClassId)
      : hasProfileTrace;

  const hasEverBeenEnrolled =
    (validEnrollmentCount !== null && validEnrollmentCount > 0) ||
    hasProfileTrace;

  return { hasActiveOrCompletedEnrollment, hasEverBeenEnrolled };
}
