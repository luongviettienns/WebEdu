import { ConflictException } from '@nestjs/common';
import { ClassStatus, type Prisma } from '@prisma/client';

/**
 * FUNC-006: a teacher may not be deactivated / stripped of the TEACHER role
 * while still leading UPCOMING or ACTIVE classes. Shared by TeachersService and
 * UserRoleStatusService so both enforce the identical rule and message.
 *
 * The effective count is the larger of the cached profile counter and the live
 * Class count, so a stale counter can never let a teacher slip through.
 */
export async function countEffectiveActiveClasses(
  tx: Prisma.TransactionClient,
  teacherId: string,
  profileActiveClassesCount: number,
): Promise<{ effective: number; fromDb: number }> {
  const fromDb = tx.class?.count
    ? await tx.class.count({
        where: {
          teacherId,
          status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
        },
      })
    : 0;
  return {
    effective: Math.max(profileActiveClassesCount, fromDb),
    fromDb,
  };
}

export function assertNoActiveClassesLed(effectiveCount: number): void {
  if (effectiveCount > 0) {
    throw new ConflictException(
      `Giáo viên đang phụ trách ${effectiveCount} lớp. Vui lòng phân công giáo viên khác`,
    );
  }
}
