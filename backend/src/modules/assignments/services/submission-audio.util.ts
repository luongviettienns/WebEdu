import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClassStatus, Prisma, QuestionType, SubmissionStatus } from '@prisma/client';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { DbClient } from '../policies/assignment-access.policy.js';
import { isRecord } from '../policies/submission-payload.util.js';
import { lockAndFindActiveSubmission, lockStudentAssignment } from './submission-session.util.js';

export const AUDIO_LISTEN_WINDOW_MS = 2 * 60 * 1000;

export async function loadAssignmentForMediaStream(db: DbClient, assignmentId: string) {
  const assignment = await db.classAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      classId: true,
      assessmentId: true,
      assessment: {
        select: {
          questions: {
            where: { type: QuestionType.LISTENING },
            select: { id: true, payload: true },
          },
        },
      },
    },
  });
  if (!assignment) {
    throw new NotFoundException('Không tìm thấy bài giao');
  }
  return assignment;
}

async function consumeQuestionListeningQuota(
  tx: Prisma.TransactionClient,
  submission: {
    id: string;
    answers: ReadonlyArray<{
      questionId: string;
      audioPlayCount: number;
      lastAudioPlayAt?: Date | null;
    }>;
  },
  question: { id: string; payload: unknown },
  now: Date,
): Promise<void> {
  const p = isRecord(question.payload) ? question.payload : {};
  const maxListens = typeof p.maxListens === 'number' && p.maxListens > 0 ? p.maxListens : null;
  const existing = submission.answers.find((ans) => ans.questionId === question.id);
  const currentPlays = existing?.audioPlayCount ?? 0;
  const lastPlayAt = existing?.lastAudioPlayAt ?? null;
  const withinActivePlayWindow =
    currentPlays > 0 &&
    lastPlayAt !== null &&
    now.getTime() - lastPlayAt.getTime() < AUDIO_LISTEN_WINDOW_MS;

  if (withinActivePlayWindow) {
    if (maxListens !== null && currentPlays > maxListens) {
      throw new BadRequestException('Đã hết lượt nghe cho phép');
    }
    return;
  }

  if (maxListens !== null && currentPlays >= maxListens) {
    throw new BadRequestException('Đã hết lượt nghe cho phép');
  }

  await tx.submissionAnswer.upsert({
    where: {
      submissionId_questionId: {
        submissionId: submission.id,
        questionId: question.id,
      },
    },
    create: {
      submissionId: submission.id,
      questionId: question.id,
      answerPayload: {},
      audioPlayCount: currentPlays + 1,
      lastAudioPlayAt: now,
    },
    update: {
      audioPlayCount: currentPlays + 1,
      lastAudioPlayAt: now,
    },
  });
}

export async function recordListeningStreamQuota(
  prisma: PrismaService,
  assignmentId: string,
  studentId: string,
  listeningQuestions: ReadonlyArray<{ id: string; payload: unknown }>,
  mediaId: string,
  questionId?: string,
  now: Date = new Date(),
): Promise<void> {
  const matchingQuestions = listeningQuestions.filter(
    (q) => isRecord(q.payload) && q.payload.mediaId === mediaId,
  );
  if (matchingQuestions.length === 0) return;
  if (!questionId && matchingQuestions.length > 1) {
    throw new BadRequestException('Vui lòng chọn câu hỏi cần nghe');
  }
  const question = questionId
    ? matchingQuestions.find((candidate) => candidate.id === questionId)
    : matchingQuestions[0];
  if (!question) throw new NotFoundException('Tệp nghe không thuộc câu hỏi này');

  await prisma.$transaction(async (tx) => {
    await lockStudentAssignment(tx, assignmentId);
    const assignment = await tx.classAssignment.findUnique({
      where: { id: assignmentId },
      select: { class: { select: { status: true } } },
    });
    if (assignment?.class?.status === ClassStatus.COMPLETED ||
        assignment?.class?.status === ClassStatus.ARCHIVED) return;
    const submission = await lockAndFindActiveSubmission(tx, assignmentId, studentId);
    if (!submission) {
      throw new BadRequestException('Chưa bắt đầu làm bài');
    }
    if (submission.status !== SubmissionStatus.IN_PROGRESS) return;

    await consumeQuestionListeningQuota(tx, submission, question, now);
  });
}
