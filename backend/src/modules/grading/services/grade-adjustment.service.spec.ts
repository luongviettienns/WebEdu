import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  QuestionType,
  Role,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AssignmentAccessPolicy } from '../../assignments/policies/assignment-access.policy.js';
import { GradeAdjustmentService } from './grade-adjustment.service.js';

function makeActor(id: string, role: Role): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    phone: '0901000001',
    fullName: id,
    roles: [role],
    effectiveRole: role,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('GradeAdjustmentService (Slice 7.4 — FUNC-061, FUNC-064)', () => {
  function setupMocks() {
    const prisma = {
      class: {
        findUnique: vi.fn(async () => ({
          id: 'cls-1',
          code: 'HSK1-K26-01',
          teacherId: 'teacher-1',
          courseId: 'course-1',
          status: 'ACTIVE',
          course: { name: 'HSK 1' },
        })),
      },
      submission: {
        findUnique: vi.fn(),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: 'sub-1',
          status: args.data.gradeUpdatedAt ? SubmissionStatus.RETURNED : SubmissionStatus.GRADED,
          totalScore: args.data.totalScore,
          teacherFeedback: args.data.teacherFeedback ?? null,
          gradeUpdatedAt: args.data.gradeUpdatedAt ?? null,
        })),
      },
      submissionAnswer: {
        upsert: vi.fn(async () => ({ id: 'ans-2' })),
        findMany: vi.fn(async () => [
          { questionId: 'q-1', earnedPoints: 4 },
          { questionId: 'q-2', earnedPoints: 4.5 },
        ]),
      },
      gradeAuditLog: { create: vi.fn(async () => ({})) },
      systemAuditLog: { create: vi.fn(async () => ({})) },
      $queryRaw: vi.fn(async () => []),
      $transaction: vi.fn(),
    };
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
    const service = new GradeAdjustmentService(prisma as never, new AssignmentAccessPolicy());
    return { prisma, service };
  }

  it('requires non-empty reason (400), allows Admin & current teacher on RETURNED/GRADED, logs GradeAuditLog, and sets gradeUpdatedAt only when RETURNED', async () => {
    const { prisma, service } = setupMocks();

    await expect(
      service.adjustConfirmedOrPublishedGrade(
        'sub-1',
        { reason: '   ', teacherFeedback: 'Updated' },
        makeActor('teacher-1', Role.TEACHER),
      ),
    ).rejects.toThrow(BadRequestException);

    // GRADED edit -> no gradeUpdatedAt yet
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.GRADED,
      totalScore: 7.5,
      teacherFeedback: 'Cũ',
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            { id: 'q-1', position: 1, type: QuestionType.SINGLE_CHOICE, points: 5, payload: {} },
            { id: 'q-2', position: 2, type: QuestionType.ESSAY, points: 5, payload: {} },
          ],
        },
      },
      answers: [
        { id: 'ans-1', questionId: 'q-1', earnedPoints: 4 },
        { id: 'ans-2', questionId: 'q-2', earnedPoints: 3.5 },
      ],
    });
    const gradedEdit = await service.adjustConfirmedOrPublishedGrade(
      'sub-1',
      {
        reason: 'Cộng thêm ý đúng',
        answers: [{ questionId: 'q-2', earnedPoints: 4.5, teacherComment: 'Đã bổ sung ý' }],
      },
      makeActor('teacher-1', Role.TEACHER),
    );
    expect(gradedEdit.totalScore).toBe(8.5);
    expect(gradedEdit.gradeUpdatedAt).toBeNull();
    expect(gradedEdit.auditLogsCreated).toBe(1);
    expect(prisma.gradeAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldScore: 3.5,
          newScore: 4.5,
          reason: 'Cộng thêm ý đúng',
        }),
      }),
    );

    // RETURNED edit by ADMIN -> sets gradeUpdatedAt
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.RETURNED,
      totalScore: 7.5,
      teacherFeedback: null,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            { id: 'q-1', position: 1, type: QuestionType.SINGLE_CHOICE, points: 5, payload: {} },
            { id: 'q-2', position: 2, type: QuestionType.ESSAY, points: 5, payload: {} },
          ],
        },
      },
      answers: [
        { id: 'ans-1', questionId: 'q-1', earnedPoints: 4 },
        { id: 'ans-2', questionId: 'q-2', earnedPoints: 3.5 },
      ],
    });
    const adminEdit = await service.adjustConfirmedOrPublishedGrade(
      'sub-1',
      {
        reason: 'Admin điều chỉnh sau phúc khảo',
        answers: [{ questionId: 'q-2', earnedPoints: 4.5 }],
      },
      makeActor('admin-1', Role.ADMIN),
    );
    expect(adminEdit.gradeUpdatedAt).not.toBeNull();

    // Former / non-class teacher -> 403
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.RETURNED,
      totalScore: 8.5,
      classAssignment: { classId: 'cls-1', assessment: { questions: [] } },
      answers: [],
    });
    await expect(
      service.adjustConfirmedOrPublishedGrade(
        'sub-1',
        { reason: 'Hợp lệ', teacherFeedback: 'X' },
        makeActor('former-teacher', Role.TEACHER),
      ),
    ).rejects.toThrow(ForbiddenException);

    // Unconfirmed submission -> 400
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.SUBMITTED_WAITING,
      totalScore: null,
      classAssignment: { classId: 'cls-1', assessment: { questions: [] } },
      answers: [],
    });
    await expect(
      service.adjustConfirmedOrPublishedGrade(
        'sub-1',
        { reason: 'Hợp lệ', teacherFeedback: 'X' },
        makeActor('teacher-1', Role.TEACHER),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('Issue #5: rejects duplicate questionId (400 with 0 audit), blocks stale concurrent edits (409), keeps ungraded null & preserves totalScore on comment-only edit', async () => {
    const { prisma, service } = setupMocks();

    // 1. Duplicate questionId -> 400 BEFORE any DB write
    await expect(
      service.adjustConfirmedOrPublishedGrade(
        'sub-1',
        {
          reason: 'Sửa trùng ID',
          answers: [
            { questionId: 'q-1', earnedPoints: 2 },
            { questionId: 'q-1', earnedPoints: 3 },
          ],
        },
        makeActor('teacher-1', Role.TEACHER),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.submissionAnswer.upsert).not.toHaveBeenCalled();
    expect(prisma.gradeAuditLog.create).not.toHaveBeenCalled();

    // 2. Stale previousEarnedPoints (same question modified in another tab) -> 409 Conflict
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-1',
      status: SubmissionStatus.GRADED,
      totalScore: 5.5,
      teacherFeedback: null,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [{ id: 'q-1', position: 1, type: QuestionType.ESSAY, points: 5, payload: {} }],
        },
      },
      answers: [{ id: 'ans-1', questionId: 'q-1', earnedPoints: 2, teacherComment: 'Cũ' }],
    });
    await expect(
      service.adjustConfirmedOrPublishedGrade(
        'sub-1',
        {
          reason: 'Tab B sửa câu 1 với baseline cũ',
          answers: [{ questionId: 'q-1', earnedPoints: 3, previousEarnedPoints: 1 }],
        },
        makeActor('teacher-1', Role.TEACHER),
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.submissionAnswer.upsert).not.toHaveBeenCalled();

    // 3. Comment-only edit on ungraded question preserves earnedPoints=null AND leaves submission totalScore unchanged
    prisma.submission.findUnique.mockResolvedValueOnce({
      id: 'sub-2',
      status: SubmissionStatus.GRADED,
      totalScore: 4,
      teacherFeedback: null,
      classAssignment: {
        classId: 'cls-1',
        assessment: {
          questions: [
            { id: 'q-1', position: 1, type: QuestionType.SINGLE_CHOICE, points: 4, payload: {} },
            { id: 'q-2', position: 2, type: QuestionType.ESSAY, points: 6, payload: {} },
          ],
        },
      },
      answers: [{ id: 'ans-1', questionId: 'q-1', earnedPoints: 4, teacherComment: null }],
    });
    const commentRes = await service.adjustConfirmedOrPublishedGrade(
      'sub-2',
      {
        reason: 'Bổ sung nhận xét câu tự luận',
        answers: [{ questionId: 'q-2', teacherComment: 'Diễn đạt mạch lạc hơn', previousTeacherComment: null }],
      },
      makeActor('teacher-1', Role.TEACHER),
    );
    expect(commentRes.totalScore).toBe(4);
    expect(commentRes.auditLogsCreated).toBe(0);
    expect(prisma.submissionAnswer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ earnedPoints: null, teacherComment: 'Diễn đạt mạch lạc hơn' }),
        update: expect.objectContaining({ teacherComment: 'Diễn đạt mạch lạc hơn' }),
      }),
    );
  });
});
