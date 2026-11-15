import { HEADERS_METADATA } from '@nestjs/common/constants.js';
import { Role, UserStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { AssignmentsController } from './assignments.controller.js';
import {
  AssignAssessmentDto,
  AutosaveSubmissionDto,
  ListAssignmentSubmissionsQueryDto,
  ReopenSubmissionDto,
  SubmitSubmissionDto,
} from './dto/assignments.dto.js';

const teacher: AuthenticatedUser = {
  id: 'teacher-1',
  email: 'gv@webedu.vn',
  fullName: 'Giáo viên',
  phone: '0901000001',
  roles: [Role.TEACHER],
  effectiveRole: Role.TEACHER,
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
};

const student: AuthenticatedUser = {
  id: 'student-1',
  email: 'hv@webedu.vn',
  fullName: 'Học viên',
  phone: '0901000002',
  roles: [Role.STUDENT],
  effectiveRole: Role.STUDENT,
  status: UserStatus.ACTIVE,
  tokenVersion: 0,
};

describe('AssignmentsController', () => {
  it('delegates all 10 routes cleanly to AssignmentDeliveryService and StudentSubmissionService', async () => {
    const delivery = {
      assignToClasses: vi.fn(async () => ({ items: [] })),
      listByClass: vi.fn(async () => ({ items: [] })),
      getAssignmentSubmissionsForTeacher: vi.fn(async () => ({ assignment: {}, students: [] })),
      reopenSubmission: vi.fn(async () => ({ studentId: 'student-1' })),
    };
    const submissions = {
      listMyAssignments: vi.fn(async () => ({ items: [] })),
      startOrResume: vi.fn(async () => ({ submission: { id: 'sub-1' } })),
      autosave: vi.fn(async () => ({ submission: { id: 'sub-1' } })),
      submit: vi.fn(async () => ({ submission: { id: 'sub-1' } })),
      getMySubmittedView: vi.fn(async () => ({ submission: { id: 'sub-1' } })),
      streamAssignmentMedia: vi.fn(async () => 'stream'),
    };
    const ctrl = new AssignmentsController(delivery as never, submissions as never);

    await ctrl.assignToClasses(teacher, 'asm-1', { classIds: ['c-1'], dueAt: '2026-12-01T00:00:00Z' });
    expect(delivery.assignToClasses).toHaveBeenCalledWith(
      'asm-1',
      { classIds: ['c-1'], dueAt: '2026-12-01T00:00:00Z' },
      teacher,
    );

    await ctrl.listByClass(teacher, 'c-1');
    expect(delivery.listByClass).toHaveBeenCalledWith('c-1', teacher);

    await ctrl.listMyAssignments(student);
    expect(submissions.listMyAssignments).toHaveBeenCalledWith(student);

    await ctrl.getAssignmentSubmissions(teacher, 'assign-1');
    expect(delivery.getAssignmentSubmissionsForTeacher).toHaveBeenCalledWith(
      'assign-1',
      teacher,
      undefined,
    );

    await ctrl.getAssignmentSubmissions(teacher, 'assign-1', { page: 2, limit: 25 });
    expect(delivery.getAssignmentSubmissionsForTeacher).toHaveBeenCalledWith(
      'assign-1',
      teacher,
      { page: 2, limit: 25 },
    );

    await ctrl.startOrResume(student, 'assign-1');
    expect(submissions.startOrResume).toHaveBeenCalledWith('assign-1', student);

    await ctrl.autosave(student, 'assign-1', { answers: [], elapsedSeconds: 10 });
    expect(submissions.autosave).toHaveBeenCalledWith(
      'assign-1',
      { answers: [], elapsedSeconds: 10 },
      student,
    );

    await ctrl.submit(student, 'assign-1', {});
    expect(submissions.submit).toHaveBeenCalledWith('assign-1', {}, student);

    await ctrl.getMySubmittedView(student, 'assign-1');
    expect(submissions.getMySubmittedView).toHaveBeenCalledWith('assign-1', student);

    await expect(ctrl.streamMedia(student, 'assign-1', 'm-1', 'question-1')).resolves.toBe('stream');
    expect(submissions.streamAssignmentMedia).toHaveBeenCalledWith('assign-1', 'm-1', student, 'question-1');

    await ctrl.reopenSubmission(teacher, 'sub-1', { reason: 'Mạng lag' });
    expect(delivery.reopenSubmission).toHaveBeenCalledWith(
      'sub-1',
      { reason: 'Mạng lag' },
      teacher,
    );
  });

  it('configures @Roles and Cache-Control/nosniff headers on streamMedia', () => {
    const getMethodMeta = (key: string, methodName: keyof AssignmentsController) =>
      Reflect.getMetadata(
        key,
        Object.getOwnPropertyDescriptor(AssignmentsController.prototype, methodName)?.value as object,
      );
    expect(getMethodMeta(ROLES_KEY, 'assignToClasses')).toEqual([Role.ADMIN, Role.TEACHER]);
    expect(getMethodMeta(ROLES_KEY, 'getAssignmentSubmissions')).toEqual([
      Role.ADMIN,
      Role.TEACHER,
    ]);
    expect(getMethodMeta(ROLES_KEY, 'streamMedia')).toEqual([
      Role.ADMIN,
      Role.TEACHER,
      Role.STUDENT,
    ]);
    expect(getMethodMeta(HEADERS_METADATA, 'streamMedia')).toEqual(
      expect.arrayContaining([
        { name: 'X-Content-Type-Options', value: 'nosniff' },
        { name: 'Cache-Control', value: 'private, no-store' },
      ]),
    );
  });

  it('rejects timezone-less ISO dates and oversized answers (>200) via DTO validation', async () => {
    const invalidAssign = plainToInstance(AssignAssessmentDto, {
      classIds: ['11111111-1111-4111-8111-111111111111'],
      dueAt: '2026-12-01T10:00:00',
    });
    expect(await validate(invalidAssign)).not.toHaveLength(0);

    const validAssign = plainToInstance(AssignAssessmentDto, {
      classIds: ['11111111-1111-4111-8111-111111111111'],
      dueAt: '2026-12-01T10:00:00+07:00',
    });
    expect(await validate(validAssign)).toHaveLength(0);

    const validAssignLowerZ = plainToInstance(AssignAssessmentDto, {
      classIds: ['11111111-1111-4111-8111-111111111111'],
      dueAt: '2026-12-01T10:00:00z',
    });
    expect(await validate(validAssignLowerZ)).toHaveLength(0);

    const invalidReopen = plainToInstance(ReopenSubmissionDto, {
      reason: 'Mạng lag',
      newDueAt: '2026-12-01T10:00:00',
    });
    expect(await validate(invalidReopen)).not.toHaveLength(0);

    const validReopen = plainToInstance(ReopenSubmissionDto, {
      reason: 'Mạng lag',
      newDueAt: '2026-12-01T10:00:00Z',
    });
    expect(await validate(validReopen)).toHaveLength(0);

    const validReopenLowerZ = plainToInstance(ReopenSubmissionDto, {
      reason: 'Mạng lag',
      newDueAt: '2026-12-01T10:00:00z',
    });
    expect(await validate(validReopenLowerZ)).toHaveLength(0);

    const oversizedAnswers = Array.from({ length: 201 }, () => ({
      questionId: '11111111-1111-4111-8111-111111111111',
      answerPayload: { text: 'a' },
    }));
    const oversizedAutosave = plainToInstance(AutosaveSubmissionDto, {
      answers: oversizedAnswers,
      elapsedSeconds: 10,
    });
    expect(await validate(oversizedAutosave)).not.toHaveLength(0);

    const oversizedSubmit = plainToInstance(SubmitSubmissionDto, {
      answers: oversizedAnswers,
    });
    expect(await validate(oversizedSubmit)).not.toHaveLength(0);

    expect(await validate(plainToInstance(ListAssignmentSubmissionsQueryDto, {}))).toHaveLength(0);
    expect(
      await validate(
        plainToInstance(ListAssignmentSubmissionsQueryDto, { page: '2', limit: '25' }),
      ),
    ).toHaveLength(0);
    for (const badQuery of [
      { page: '0' },
      { page: 'abc' },
      { page: '1.5' },
      { limit: '0' },
      { limit: '101' },
    ]) {
      expect(
        await validate(plainToInstance(ListAssignmentSubmissionsQueryDto, badQuery)),
      ).not.toHaveLength(0);
    }
  });
});
