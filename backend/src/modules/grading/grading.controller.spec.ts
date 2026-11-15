import { Role, UserStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import {
  AdjustGradeSubmissionDto,
  AiGradeSubmissionDto,
  AiSuggestBatchGradeDto,
  GradingTrackerQueryDto,
  ManualGradeSubmissionDto,
  RecordOverdueZeroDto,
  SubmissionBatchSelectionDto,
} from './dto/grading.dto.js';
import { GradingController } from './grading.controller.js';

const teacher: AuthenticatedUser = {
  id: 'teacher-1',
  email: 'gv@webedu.vn',
  phone: '0901000001',
  fullName: 'Cô Lan',
  roles: [Role.TEACHER],
  effectiveRole: Role.TEACHER,
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
};

const student: AuthenticatedUser = {
  id: 'student-1',
  email: 'hv@webedu.vn',
  phone: '0902000002',
  fullName: 'Nguyễn An',
  roles: [Role.STUDENT],
  effectiveRole: Role.STUDENT,
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
};

describe('GradingController (Slices 7.1–7.4)', () => {
  function setupController() {
    const autoGrading = { gradeSubmission: vi.fn(async () => ({ submissionId: 'sub-1', autoScore: 4 })) };
    const aiGrading = {
      suggestEssayGradesForSubmission: vi.fn(async () => ({ submissionId: 'sub-1', suggestions: [] })),
      suggestEssayGradesForAssignmentBatch: vi.fn(async () => ({
        assignmentId: 'assign-1',
        requestedCount: 2,
        succeededCount: 2,
        failedCount: 0,
        results: [],
      })),
    };
    const tracker = {
      getAssignmentGradingTracker: vi.fn(async () => ({ students: [] })),
      recordOverdueZero: vi.fn(async () => ({ recordedCount: 1 })),
    };
    const teacherGrading = {
      getSubmissionGradingDetail: vi.fn(async () => ({ submission: { id: 'sub-1' } })),
      gradeSubmissionManually: vi.fn(async () => ({ submissionId: 'sub-1', totalScore: 8 })),
    };
    const publication = {
      confirmSubmissionGrade: vi.fn(async () => ({ submissionId: 'sub-1', status: 'GRADED' })),
      confirmAssignmentGradesBatch: vi.fn(async () => ({ confirmedCount: 2 })),
      publishAssignmentGrades: vi.fn(async () => ({ publishedCount: 2 })),
    };
    const adjustment = {
      adjustConfirmedOrPublishedGrade: vi.fn(async () => ({ submissionId: 'sub-1', totalScore: 8.5 })),
    };
    const publishedRepo = {
      getStudentPublishedResult: vi.fn(async () => ({ isPublished: true })),
    };
    const ctrl = new GradingController(
      autoGrading as never,
      aiGrading as never,
      tracker as never,
      teacherGrading as never,
      publication as never,
      adjustment as never,
      publishedRepo as never,
    );
    return { ctrl, autoGrading, aiGrading, tracker, teacherGrading, publication, adjustment, publishedRepo };
  }

  it('delegates all 12 grading endpoints cleanly and enforces expected @Roles metadata', async () => {
    const mocks = setupController();
    const { ctrl } = mocks;

    await ctrl.getAssignmentGradingTracker(teacher, 'assign-1', { status: 'NEEDS_GRADING' });
    expect(mocks.tracker.getAssignmentGradingTracker).toHaveBeenCalledWith('assign-1', teacher, { status: 'NEEDS_GRADING' });

    await ctrl.recordOverdueZero(teacher, 'assign-1', { reason: 'Quá hạn' });
    expect(mocks.tracker.recordOverdueZero).toHaveBeenCalledWith('assign-1', { reason: 'Quá hạn' }, teacher);

    await ctrl.confirmAssignmentGradesBatch(teacher, 'assign-1', {});
    expect(mocks.publication.confirmAssignmentGradesBatch).toHaveBeenCalledWith('assign-1', {}, teacher);

    await ctrl.publishAssignmentGrades(teacher, 'assign-1', { submissionIds: ['sub-1'] });
    expect(mocks.publication.publishAssignmentGrades).toHaveBeenCalledWith('assign-1', { submissionIds: ['sub-1'] }, teacher);

    await ctrl.suggestAssignmentEssayGradesBatch(teacher, 'assign-1', { submissionIds: ['sub-1'] });
    expect(mocks.aiGrading.suggestEssayGradesForAssignmentBatch).toHaveBeenCalledWith(
      'assign-1',
      { submissionIds: ['sub-1'] },
      teacher,
    );

    await ctrl.getStudentPublishedResult(student, 'assign-1');
    expect(mocks.publishedRepo.getStudentPublishedResult).toHaveBeenCalledWith('assign-1', student);

    await ctrl.getSubmissionGradingDetail(teacher, 'sub-1');
    expect(mocks.teacherGrading.getSubmissionGradingDetail).toHaveBeenCalledWith('sub-1', teacher);

    await ctrl.autoGradeSubmission(teacher, 'sub-1');
    expect(mocks.autoGrading.gradeSubmission).toHaveBeenCalledWith('sub-1', teacher);

    await ctrl.suggestEssayGrades(teacher, 'sub-1', { questionId: '11111111-1111-4111-8111-111111111111' });
    expect(mocks.aiGrading.suggestEssayGradesForSubmission).toHaveBeenCalled();

    await ctrl.gradeSubmissionManually(teacher, 'sub-1', { teacherFeedback: 'Tốt' });
    expect(mocks.teacherGrading.gradeSubmissionManually).toHaveBeenCalledWith('sub-1', { teacherFeedback: 'Tốt' }, teacher);

    await ctrl.confirmSubmissionGrade(teacher, 'sub-1');
    expect(mocks.publication.confirmSubmissionGrade).toHaveBeenCalledWith('sub-1', teacher);

    await ctrl.adjustConfirmedOrPublishedGrade(teacher, 'sub-1', { reason: 'Cộng điểm', answers: [] });
    expect(mocks.adjustment.adjustConfirmedOrPublishedGrade).toHaveBeenCalledWith('sub-1', { reason: 'Cộng điểm', answers: [] }, teacher);

    for (const methodName of [
      'getAssignmentGradingTracker',
      'recordOverdueZero',
      'confirmAssignmentGradesBatch',
      'publishAssignmentGrades',
      'suggestAssignmentEssayGradesBatch',
      'getSubmissionGradingDetail',
      'autoGradeSubmission',
      'suggestEssayGrades',
      'gradeSubmissionManually',
      'confirmSubmissionGrade',
      'adjustConfirmedOrPublishedGrade',
    ] as const) {
      const target = Object.getOwnPropertyDescriptor(GradingController.prototype, methodName)?.value as object;
      expect(Reflect.getMetadata(ROLES_KEY, target)).toEqual([Role.TEACHER, Role.ADMIN]);
    }

    const studentResultTarget = Object.getOwnPropertyDescriptor(
      GradingController.prototype,
      'getStudentPublishedResult',
    )?.value as object;
    expect(Reflect.getMetadata(ROLES_KEY, studentResultTarget)).toEqual([Role.STUDENT]);
  });

  it('validates Slice 7.2–7.4 & Batch AI DTOs cleanly (including strict blank-score rejection and max 20 batch limit)', async () => {
    expect(await validate(plainToInstance(AiGradeSubmissionDto, {}))).toHaveLength(0);
    expect(await validate(plainToInstance(AiGradeSubmissionDto, { questionId: 'bad-id' }))).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(AiSuggestBatchGradeDto, {
          submissionIds: ['11111111-1111-4111-8111-111111111111'],
        }),
      ),
    ).toHaveLength(0);
    const overMaxIds = Array.from(
      { length: 21 },
      (_, idx) => `11111111-1111-4111-8111-${String(idx).padStart(12, '0')}`,
    );
    expect(
      await validate(plainToInstance(AiSuggestBatchGradeDto, { submissionIds: overMaxIds })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(GradingTrackerQueryDto, { status: 'OVERDUE_NOT_SUBMITTED', page: 1, limit: 25 }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(GradingTrackerQueryDto, { status: 'INVALID_FILTER' })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ManualGradeSubmissionDto, {
          teacherFeedback: 'Tốt',
          answers: [{ questionId: '11111111-1111-4111-8111-111111111111', earnedPoints: 3.5 }],
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(RecordOverdueZeroDto, { reason: '  Hết hạn  ' })),
    ).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(SubmissionBatchSelectionDto, {
          submissionIds: ['11111111-1111-4111-8111-111111111111'],
        }),
      ),
    ).toHaveLength(0);

    const blankReasonErrors = await validate(
      plainToInstance(AdjustGradeSubmissionDto, { reason: '   ', teacherFeedback: 'X' }),
    );
    expect(blankReasonErrors.length).toBeGreaterThan(0);

    const blankScoreErrors = await validate(
      plainToInstance(AdjustGradeSubmissionDto, {
        reason: 'Hợp lệ',
        answers: [{ questionId: '11111111-1111-4111-8111-111111111111', earnedPoints: '   ' }],
      }),
    );
    expect(blankScoreErrors.length).toBeGreaterThan(0);

    const validAdjustErrors = await validate(
      plainToInstance(AdjustGradeSubmissionDto, {
        reason: 'Sửa sai sót chấm câu 2',
        answers: [{ questionId: '11111111-1111-4111-8111-111111111111', earnedPoints: 4.25, previousEarnedPoints: null }],
      }),
    );
    expect(validAdjustErrors).toHaveLength(0);
    const legacyAdjustErrors = await validate(
      plainToInstance(AdjustGradeSubmissionDto, {
        reason: 'Sửa điểm đề nhập cũ',
        answers: [{ questionId: '11111111-1111-4111-8111-111111111111', earnedPoints: 1, previousEarnedPoints: 1001 }],
      }),
    );
    expect(legacyAdjustErrors).toHaveLength(0);
  });
});
