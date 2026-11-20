import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function assertNoDuplicateQuestionIds(
  answers: ReadonlyArray<{ questionId: string }>,
  errorMessage = 'Danh sách câu hỏi có questionId bị trùng lặp',
): void {
  const seen = new Set<string>();
  for (const item of answers) {
    if (seen.has(item.questionId)) {
      throw new BadRequestException(errorMessage);
    }
    seen.add(item.questionId);
  }
}

export function assertOptimisticTeacherFeedbackMatch(
  currentFeedback: string | null | undefined,
  previousFeedback: string | null | undefined,
): void {
  if (previousFeedback === undefined) return;
  const normalizedCurrent = currentFeedback?.trim() || null;
  const normalizedExpected = previousFeedback?.trim() || null;
  if (normalizedCurrent !== normalizedExpected) {
    throw new ConflictException(
      'Nhận xét tổng quan đã bị thay đổi từ tab hoặc phiên làm việc khác. Vui lòng tải lại trước khi lưu.',
    );
  }
}

export function assertOptimisticAnswerMatch(params: {
  questionPosition: number;
  existingPoints: number | null;
  existingComment: string | null;
  previousEarnedPoints?: number | null;
  previousTeacherComment?: string | null;
}): void {
  if (params.previousEarnedPoints !== undefined) {
    const expected =
      params.previousEarnedPoints === null ? null : Number(params.previousEarnedPoints);
    const matches =
      params.existingPoints === null || expected === null
        ? params.existingPoints === expected
        : Math.abs(params.existingPoints - expected) < 1e-6;
    if (!matches) {
      throw new ConflictException(
        `Điểm câu ${params.questionPosition} đã bị thay đổi từ tab hoặc phiên làm việc khác. Vui lòng tải lại trước khi lưu.`,
      );
    }
  }
  if (params.previousTeacherComment !== undefined) {
    const normalizedExpected = params.previousTeacherComment?.trim() || null;
    if (params.existingComment !== normalizedExpected) {
      throw new ConflictException(
        `Nhận xét câu ${params.questionPosition} đã bị thay đổi từ tab hoặc phiên làm việc khác. Vui lòng tải lại trước khi lưu.`,
      );
    }
  }
}

export async function lockClassRowForAssignmentTx(
  tx: Prisma.TransactionClient,
  assignmentId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM "classes"
    WHERE id = (SELECT class_id FROM "class_assignments" WHERE id = ${assignmentId})
    FOR SHARE
  `;
}

export async function lockClassRowForSubmissionTx(
  tx: Prisma.TransactionClient,
  submissionId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM "classes"
    WHERE id = (
      SELECT ca.class_id FROM "submissions" s
      JOIN "class_assignments" ca ON ca.id = s.class_assignment_id
      WHERE s.id = ${submissionId}
    )
    FOR SHARE
  `;
}

export async function lockClassAssignmentRowTx(
  tx: Prisma.TransactionClient,
  assignmentId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM "class_assignments"
    WHERE id = ${assignmentId}
    FOR UPDATE
  `;
}

export async function lockSubmissionRowsTx(
  tx: Prisma.TransactionClient,
  submissionIds: ReadonlyArray<string>,
): Promise<void> {
  const sortedIds = [...new Set(submissionIds)].sort();
  if (sortedIds.length === 0) return;

  await tx.$queryRaw`
    SELECT id FROM "submissions"
    WHERE id IN (${Prisma.join(sortedIds)})
    ORDER BY id ASC
    FOR UPDATE
  `;
}

export async function lockAssignmentSubmissionsOrderedTx(
  tx: Prisma.TransactionClient,
  assignmentId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM "submissions"
    WHERE class_assignment_id = ${assignmentId}
    ORDER BY id ASC
    FOR UPDATE
  `;
}

export async function zeroOutSubmissionAnswersTx(
  tx: Prisma.TransactionClient,
  submissionIds: readonly string[],
  questions: ReadonlyArray<{ id: string }>,
): Promise<void> {
  if (submissionIds.length === 0 || questions.length === 0) return;
  const grade = {
    earnedPoints: 0,
    isCorrect: null,
    aiSuggestedPoints: null,
    aiFeedback: null,
    teacherEdited: true,
  };
  await tx.submissionAnswer.createMany({
    data: submissionIds.flatMap((submissionId) =>
      questions.map(({ id: questionId }) => ({ submissionId, questionId, answerPayload: {}, ...grade })),
    ),
    skipDuplicates: true,
  });
}
