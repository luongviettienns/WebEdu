import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, Prisma, Role } from '@prisma/client';

export type AssessmentActor = { id: string; roles: Role[] };

export type AssessmentGuardRow = {
  id: string;
  createdById: string;
  status: AssessmentStatus;
  isLocked: boolean;
};

export function assertCanMutateAssessment(actor: AssessmentActor, createdById: string): void {
  if (actor.roles.includes(Role.ADMIN)) return;
  if (actor.roles.includes(Role.TEACHER) && actor.id === createdById) return;
  throw new ForbiddenException('Chỉ người tạo hoặc Admin mới được sửa đề này');
}

/** Own drafts, or any published paper. Other teachers do not see someone else's nháp. */
export function assertCanViewAssessment(actor: AssessmentActor, row: AssessmentGuardRow | null): asserts row is AssessmentGuardRow {
  if (!row) throw new NotFoundException('Không tìm thấy đề');
  if (actor.roles.includes(Role.ADMIN)) return;
  if (actor.roles.includes(Role.TEACHER) && (actor.id === row.createdById || row.status === AssessmentStatus.PUBLISHED)) {
    return;
  }
  throw new NotFoundException('Không tìm thấy đề');
}

export function listVisibilityWhere(actor: AssessmentActor): Prisma.AssessmentWhereInput {
  if (actor.roles.includes(Role.ADMIN)) return {};
  if (actor.roles.includes(Role.TEACHER)) {
    return { OR: [{ createdById: actor.id }, { status: AssessmentStatus.PUBLISHED }] };
  }
  return { id: '00000000-0000-0000-0000-000000000000' };
}

export function assertEditableAssessment(actor: AssessmentActor, row: AssessmentGuardRow | null): AssessmentGuardRow {
  if (!row) throw new NotFoundException('Không tìm thấy đề');
  assertCanMutateAssessment(actor, row.createdById);
  if (row.isLocked || row.status === AssessmentStatus.PUBLISHED) {
    throw new ConflictException('Đề đã phát hành, chỉ được nhân bản bản mới');
  }
  return row;
}

export function assertActiveCourseRow(course: { isActive: boolean } | null): void {
  if (!course) throw new NotFoundException('Không tìm thấy khóa học');
  if (course.isActive === false) {
    throw new BadRequestException('Khóa học HSK hiện đang ngừng hoạt động');
  }
}

export async function assertActiveCourseWithShareLockInTx(
  tx: Prisma.TransactionClient,
  courseId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "courses" WHERE id = ${courseId} FOR SHARE`;
  const course = await tx.course.findUnique({
    where: { id: courseId },
    select: { id: true, isActive: true },
  });
  assertActiveCourseRow(course);
}
