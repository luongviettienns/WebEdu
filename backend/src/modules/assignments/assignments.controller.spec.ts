import { Role, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { AssignmentsController } from './assignments.controller.js';

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
    expect(delivery.getAssignmentSubmissionsForTeacher).toHaveBeenCalledWith('assign-1', teacher);

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

    await expect(ctrl.streamMedia(student, 'assign-1', 'm-1')).resolves.toBe('stream');
    expect(submissions.streamAssignmentMedia).toHaveBeenCalledWith('assign-1', 'm-1', student);

    await ctrl.reopenSubmission(teacher, 'sub-1', { reason: 'Mạng lag' });
    expect(delivery.reopenSubmission).toHaveBeenCalledWith(
      'sub-1',
      { reason: 'Mạng lag' },
      teacher,
    );
  });
});
