import { EnrollmentStatus, type Prisma } from '@prisma/client';

export interface EnrollmentFacts {
  /** The student has at least one ACTIVE enrollment right now (or a current class). */
  hasActiveEnrollment: boolean;
  /** The student has at least one ACTIVE or COMPLETED enrollment (or a current class). */
  hasActiveOrCompletedEnrollment: boolean;
  /**
   * The student has ever been placed in a class across all statuses
   * (ACTIVE, COMPLETED, TRANSFERRED, DROPPED) or via profile trace.
   */
  hasEverBeenEnrolled: boolean;
}

export interface EnrollmentTraceProfile {
  currentClassId?: string | null;
  enrolledAt?: Date | null;
  assignedClass?: string | null;
}

/**
 * Derives the enrollment facts that gate FUNC-008 status transitions:
 * - No PENDING_CLASS -> ACTIVE bypass without valid active/initial enrollment.
 * - No re-queueing an enrolled student (even if DROPPED or TRANSFERRED) back to PENDING_CLASS.
 * - No reactivating a dropped pure student without a valid active/completed enrollment.
 *
 * Must run inside the caller's transaction, after the student row is locked.
 * Shared across Students, Teachers, and SystemSettings modules.
 */
export async function loadEnrollmentFacts(
  tx: Prisma.TransactionClient,
  studentId: string,
  profile: EnrollmentTraceProfile | null | undefined,
): Promise<EnrollmentFacts> {
  const totalEnrollmentCount = tx.enrollment?.count
    ? await tx.enrollment.count({
        where: { studentId },
      })
    : null;

  const activeEnrollmentCount = tx.enrollment?.count
    ? await tx.enrollment.count({
        where: {
          studentId,
          status: EnrollmentStatus.ACTIVE,
        },
      })
    : null;

  const activeOrCompletedEnrollmentCount = tx.enrollment?.count
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

  const hasActiveEnrollment =
    activeEnrollmentCount !== null
      ? activeEnrollmentCount > 0 || Boolean(profile?.currentClassId)
      : Boolean(profile?.currentClassId);

  const hasActiveOrCompletedEnrollment =
    activeOrCompletedEnrollmentCount !== null
      ? activeOrCompletedEnrollmentCount > 0 || Boolean(profile?.currentClassId)
      : hasProfileTrace;

  const hasEverBeenEnrolled =
    totalEnrollmentCount !== null
      ? totalEnrollmentCount > 0 || hasProfileTrace
      : (activeOrCompletedEnrollmentCount !== null &&
          activeOrCompletedEnrollmentCount > 0) ||
        hasProfileTrace;

  return {
    hasActiveEnrollment,
    hasActiveOrCompletedEnrollment,
    hasEverBeenEnrolled,
  };
}
