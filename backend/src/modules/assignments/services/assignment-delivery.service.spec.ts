import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentStatus,
  AssessmentType,
  ClassStatus,
  GradingStatus,
  Role,
  SessionStatus,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AssignmentAccessPolicy } from '../policies/assignment-access.policy.js';
import { AssignmentDeliveryService } from './assignment-delivery.service.js';

function makeActor(id: string, roles: Role[]): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    phone: '0900000001',
    fullName: `User ${id}`,
    roles,
    effectiveRole: roles[0] ?? Role.TEACHER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

const futureIso = (hours = 24) => new Date(Date.now() + hours * 3_600_000).toISOString();
const pastIso = () => new Date(Date.now() - 60_000).toISOString();

function makeMockPrisma() {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    assessment: { findUnique: vi.fn(async () => null) },
    class: { findUnique: vi.fn(async () => null) },
    enrollment: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
    lessonSession: { findUnique: vi.fn(async () => null) },
    classAssignment: {
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    submission: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _max: { attemptNumber: 1 } })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    },
    submissionAnswer: { createMany: vi.fn(async () => ({ count: 0 })) },
    submissionReopenLog: { create: vi.fn(async () => ({})) },
    systemAuditLog: { create: vi.fn(async () => ({})) },
  };

  const prisma = {
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    class: tx.class,
    enrollment: tx.enrollment,
    classAssignment: tx.classAssignment,
    submission: tx.submission,
    tx,
  };
  return prisma;
}

describe('AssignmentDeliveryService (RED-GREEN TDD)', () => {
  const accessPolicy = new AssignmentAccessPolicy();
  const teacher = makeActor('teacher-1', [Role.TEACHER]);
  const otherTeacher = makeActor('teacher-2', [Role.TEACHER]);
  const admin = makeActor('admin-1', [Role.ADMIN]);
  const student = makeActor('student-1', [Role.STUDENT]);

  describe('assignToClasses', () => {
    it('rejects past or invalid dueAt without starting a transaction', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);

      await expect(
        service.assignToClasses('asm-1', { classIds: ['cls-1'], dueAt: pastIso() }, teacher),
      ).rejects.toThrowError(new BadRequestException('Hạn nộp bài phải ở tương lai'));

      await expect(
        service.assignToClasses('asm-1', { classIds: ['cls-1'], dueAt: 'not-a-date' }, teacher),
      ).rejects.toThrowError(new BadRequestException('Hạn nộp bài phải ở tương lai'));

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects attaching sessionId when assigning to multiple classes', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);

      await expect(
        service.assignToClasses(
          'asm-1',
          { classIds: ['cls-1', 'cls-2'], dueAt: futureIso(), sessionId: 'sess-1' },
          teacher,
        ),
      ).rejects.toThrowError(new BadRequestException('Chỉ gắn buổi học khi giao cho 1 lớp'));
    });

    it('hides missing assessments and foreign drafts with 404, and rejects own DRAFT with 400', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);

      prisma.tx.assessment.findUnique.mockResolvedValueOnce(null as never);
      await expect(
        service.assignToClasses('asm-missing', { classIds: ['cls-1'], dueAt: futureIso() }, teacher),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy đề'));

      prisma.tx.assessment.findUnique.mockResolvedValueOnce({
        id: 'asm-1',
        createdById: 'teacher-1',
        status: AssessmentStatus.DRAFT,
        courseId: 'course-1',
        durationMinutes: 45,
        questions: [],
      } as never);
      await expect(
        service.assignToClasses('asm-1', { classIds: ['cls-1'], dueAt: futureIso() }, otherTeacher),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy đề'));

      prisma.tx.assessment.findUnique.mockResolvedValueOnce({
        id: 'asm-1',
        createdById: 'teacher-1',
        status: AssessmentStatus.DRAFT,
        courseId: 'course-1',
        durationMinutes: 45,
        questions: [],
      } as never);
      await expect(
        service.assignToClasses('asm-1', { classIds: ['cls-1'], dueAt: futureIso() }, teacher),
      ).rejects.toThrowError(new BadRequestException('Chỉ có thể giao đề đã phát hành'));
    });

    it('rejects unassigned teacher, mismatched course, completed/archived class, and invalid session', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);

      const publishedAsm = {
        id: 'asm-1',
        createdById: 'admin-1',
        status: AssessmentStatus.PUBLISHED,
        courseId: 'course-1',
        durationMinutes: 30,
        questions: [{ points: 2 }],
      };

      prisma.tx.assessment.findUnique.mockResolvedValue(publishedAsm as never);

      // Unassigned teacher -> 403
      prisma.tx.class.findUnique.mockResolvedValueOnce({
        id: 'cls-1',
        code: 'HSK1-A',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      } as never);
      await expect(
        service.assignToClasses('asm-1', { classIds: ['cls-1'], dueAt: futureIso() }, otherTeacher),
      ).rejects.toThrow(ForbiddenException);

      // Mismatched course -> 400
      prisma.tx.class.findUnique.mockResolvedValueOnce({
        id: 'cls-other-course',
        code: 'HSK2-A',
        teacherId: 'teacher-1',
        courseId: 'course-2',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 2' },
        teacherHistory: [],
      } as never);
      await expect(
        service.assignToClasses(
          'asm-1',
          { classIds: ['cls-other-course'], dueAt: futureIso() },
          teacher,
        ),
      ).rejects.toThrowError(new BadRequestException('Lớp học không thuộc khóa học của đề này'));

      // COMPLETED or ARCHIVED class -> 400
      prisma.tx.class.findUnique.mockResolvedValueOnce({
        id: 'cls-done',
        code: 'HSK1-DONE',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.COMPLETED,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      } as never);
      await expect(
        service.assignToClasses('asm-1', { classIds: ['cls-done'], dueAt: futureIso() }, teacher),
      ).rejects.toThrowError(
        new BadRequestException('Không thể giao bài cho lớp đã kết thúc hoặc lưu trữ'),
      );

      // Cancelled session -> 400
      prisma.tx.class.findUnique.mockResolvedValueOnce({
        id: 'cls-1',
        code: 'HSK1-A',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      } as never);
      prisma.tx.lessonSession.findUnique.mockResolvedValueOnce({
        id: 'sess-cancelled',
        classId: 'cls-1',
        status: SessionStatus.CANCELLED,
      } as never);
      await expect(
        service.assignToClasses(
          'asm-1',
          { classIds: ['cls-1'], dueAt: futureIso(), sessionId: 'sess-cancelled' },
          teacher,
        ),
      ).rejects.toThrowError(new BadRequestException('Không thể gắn bài vào buổi học đã hủy'));

      // Wrong class session -> 400
      prisma.tx.class.findUnique.mockResolvedValueOnce({
        id: 'cls-1',
        code: 'HSK1-A',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      } as never);
      prisma.tx.lessonSession.findUnique.mockResolvedValueOnce({
        id: 'sess-other',
        classId: 'cls-2',
        status: SessionStatus.SCHEDULED,
      } as never);
      await expect(
        service.assignToClasses(
          'asm-1',
          { classIds: ['cls-1'], dueAt: futureIso(), sessionId: 'sess-other' },
          teacher,
        ),
      ).rejects.toThrowError(new BadRequestException('Buổi học không thuộc lớp được chọn'));
    });

    it('locks assessment and sorted unique classes FOR UPDATE, creates assignments, writes audit log, and returns summaries', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);
      const dueAt = futureIso(48);

      prisma.tx.assessment.findUnique.mockResolvedValueOnce({
        id: 'asm-1',
        createdById: 'teacher-1',
        status: AssessmentStatus.PUBLISHED,
        courseId: 'course-1',
        durationMinutes: 45,
        questions: [{ points: 2 }, { points: 3 }],
      } as never);

      prisma.tx.class.findUnique.mockImplementation((async (args: { where: { id: string } }) => ({
        id: args.where.id,
        code: args.where.id.toUpperCase(),
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      })) as never);

      let createIdx = 0;
      prisma.tx.classAssignment.create.mockImplementation((async (args: {
        data: {
          assessmentId: string;
          classId: string;
          sessionId: string | null;
          assignedById: string;
          dueAt: Date;
          effectiveDurationMinutes: number | null;
          instructions: string | null;
        };
      }) => {
        createIdx += 1;
        return {
          id: `assign-${createIdx}`,
          ...args.data,
          assignedAt: new Date('2026-11-14T12:00:00.000Z'),
          assessment: {
            title: 'Đề HSK 1',
            type: AssessmentType.MINI_TEST,
            description: 'Mô tả',
            courseId: 'course-1',
            questions: [{ points: 2 }, { points: 3 }],
          },
          class: { code: args.data.classId.toUpperCase(), course: { name: 'HSK 1' } },
          assignedBy: { fullName: 'User teacher-1' },
        };
      }) as never);

      const res = await service.assignToClasses(
        'asm-1',
        { classIds: ['cls-b', 'cls-a', 'cls-b'], dueAt, instructions: '  Làm bài kỹ  ' },
        teacher,
      );

      expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(3);
      expect(prisma.tx.class.findUnique).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { id: 'cls-a' } }),
      );
      expect(prisma.tx.class.findUnique).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { id: 'cls-b' } }),
      );
      expect(res.items).toHaveLength(2);
      expect(res.items[0]).toMatchObject({
        id: 'assign-1',
        classId: 'cls-a',
        effectiveDurationMinutes: 45,
        instructions: 'Làm bài kỹ',
        questionCount: 2,
        totalPoints: 5,
      });
      expect(prisma.tx.systemAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ASSESSMENT_ASSIGNED',
            targetType: 'Assessment',
            targetId: 'asm-1',
          }),
        }),
      );
    });
  });

  describe('listByClass', () => {
    const classRecord = {
      id: 'cls-1',
      code: 'HSK1-A',
      teacherId: 'teacher-1',
      courseId: 'course-1',
      status: ClassStatus.ACTIVE,
      course: { name: 'HSK 1' },
      teacherHistory: [],
    };
    const assignmentRow = {
      id: 'assign-1',
      assessmentId: 'asm-1',
      classId: 'cls-1',
      sessionId: null,
      assignedById: 'teacher-1',
      assignedAt: new Date('2026-11-14T10:00:00.000Z'),
      dueAt: new Date('2026-11-20T10:00:00.000Z'),
      effectiveDurationMinutes: 30,
      instructions: null,
      assessment: {
        title: 'Bài tập 1',
        type: AssessmentType.HOMEWORK,
        description: null,
        courseId: 'course-1',
        questions: [{ points: 1 }],
      },
      class: { code: 'HSK1-A', course: { name: 'HSK 1' } },
      assignedBy: { fullName: 'Teacher 1' },
    };

    it('includes submission stats for TEACHER/ADMIN and omits stats for STUDENT', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);

      prisma.class.findUnique.mockResolvedValue(classRecord as never);
      prisma.classAssignment.findMany.mockResolvedValue([assignmentRow] as never);
      prisma.enrollment.findMany.mockResolvedValue([
        { studentId: 's-1' },
        { studentId: 's-2' },
        { studentId: 's-3' },
        { studentId: 's-4' },
        { studentId: 's-5' },
      ] as never);
      prisma.submission.findMany.mockResolvedValue([
        { classAssignmentId: 'assign-1', studentId: 's-1', status: SubmissionStatus.IN_PROGRESS },
        {
          classAssignmentId: 'assign-1',
          studentId: 's-2',
          status: SubmissionStatus.SUBMITTED_WAITING,
        },
        {
          classAssignmentId: 'assign-1',
          studentId: 's-3',
          status: SubmissionStatus.AUTO_GRADED_PENDING_REVIEW,
        },
        { classAssignmentId: 'assign-1', studentId: 's-4', status: SubmissionStatus.RETURNED },
        {
          classAssignmentId: 'assign-1',
          studentId: 's-dropped',
          status: SubmissionStatus.SUBMITTED_WAITING,
        },
      ] as never);

      const teacherList = await service.listByClass('cls-1', teacher);
      expect(teacherList.items[0]?.stats).toEqual({
        totalStudents: 5,
        notStartedCount: 1,
        inProgressCount: 1,
        submittedWaitingCount: 1,
        gradedCount: 2,
      });

      prisma.enrollment.findFirst.mockResolvedValueOnce({ id: 'enr-1' } as never);
      const studentList = await service.listByClass('cls-1', student);
      expect(studentList.items).toHaveLength(1);
      expect('stats' in (studentList.items[0] ?? {})).toBe(false);
    });
  });

  describe('getAssignmentSubmissionsForTeacher', () => {
    it('throws 404 when assignment is missing and returns tracker rows with stats', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);

      prisma.classAssignment.findUnique.mockResolvedValueOnce(null as never);
      await expect(
        service.getAssignmentSubmissionsForTeacher('missing', admin),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy bài giao'));

      prisma.classAssignment.findUnique.mockResolvedValueOnce({
        id: 'assign-1',
        assessmentId: 'asm-1',
        classId: 'cls-1',
        sessionId: null,
        assignedById: 'teacher-1',
        assignedAt: new Date('2026-11-14T10:00:00.000Z'),
        dueAt: new Date('2026-11-20T10:00:00.000Z'),
        effectiveDurationMinutes: 30,
        instructions: null,
        assessment: {
          title: 'Kiểm tra',
          type: AssessmentType.MINI_TEST,
          description: null,
          courseId: 'course-1',
          questions: [{ points: 2 }, { points: 3 }],
        },
        class: { code: 'HSK1-A', course: { name: 'HSK 1' } },
        assignedBy: { fullName: 'Admin' },
      } as never);
      prisma.class.findUnique.mockResolvedValueOnce({
        id: 'cls-1',
        code: 'HSK1-A',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      } as never);
      prisma.enrollment.findMany.mockResolvedValueOnce([
        { student: { id: 's-1', fullName: 'An', email: 'an@webedu.vn' } },
        { student: { id: 's-2', fullName: 'Bình', email: 'binh@webedu.vn' } },
      ] as never);
      prisma.submission.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          studentId: 's-1',
          attemptNumber: 1,
          status: SubmissionStatus.SUBMITTED_WAITING,
          startedAt: new Date('2026-11-14T11:00:00.000Z'),
          lastSavedAt: new Date('2026-11-14T11:05:00.000Z'),
          submittedAt: new Date('2026-11-14T11:05:00.000Z'),
          autoSubmitted: false,
          elapsedSeconds: 300,
          remainingSeconds: 1500,
          answers: [{ answerPayload: { text: '你好' } }],
          reopenLogs: [],
        },
      ] as never);

      const tracker = await service.getAssignmentSubmissionsForTeacher('assign-1', teacher);
      expect(tracker.assignment.stats).toEqual({
        totalStudents: 2,
        notStartedCount: 1,
        inProgressCount: 0,
        submittedWaitingCount: 1,
        gradedCount: 0,
      });
      expect(tracker.students).toHaveLength(2);
      expect(tracker.students[0]?.canReopen).toBe(true);
      expect(tracker.students[1]?.status).toBe('NOT_STARTED');
    });
  });

  describe('reopenSubmission', () => {
    it('validates reason, newDueAt, status conflict, and overdue without newDueAt', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);

      await expect(
        service.reopenSubmission('sub-1', { reason: '   ' }, teacher),
      ).rejects.toThrowError(new BadRequestException('Lý do mở lại bài nộp không được để trống'));

      await expect(
        service.reopenSubmission('sub-1', { reason: 'Mạng lỗi', newDueAt: pastIso() }, teacher),
      ).rejects.toThrowError(new BadRequestException('Hạn nộp mới phải ở tương lai'));

      prisma.tx.submission.findUnique.mockResolvedValueOnce(null as never);
      await expect(
        service.reopenSubmission('sub-missing', { reason: 'Mạng lỗi' }, teacher),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy bài nộp'));

      const submittedBase = {
        id: 'sub-1',
        classAssignmentId: 'assign-1',
        studentId: 's-1',
        attemptNumber: 1,
        status: SubmissionStatus.IN_PROGRESS,
        answers: [],
        student: { id: 's-1', fullName: 'An', email: 'an@webedu.vn' },
        classAssignment: {
          id: 'assign-1',
          classId: 'cls-1',
          dueAt: new Date(Date.now() + 3_600_000),
          effectiveDurationMinutes: 30,
          assessment: { questions: [{ id: 'q-1' }] },
        },
      };
      prisma.tx.class.findUnique.mockResolvedValue({
        id: 'cls-1',
        code: 'HSK1-A',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      } as never);

      prisma.tx.submission.findUnique.mockResolvedValueOnce(submittedBase as never);
      await expect(
        service.reopenSubmission('sub-1', { reason: 'Mạng lỗi' }, teacher),
      ).rejects.toThrowError(new ConflictException('Chỉ có thể mở lại bài đã nộp'));

      prisma.tx.submission.findUnique.mockResolvedValueOnce({
        ...submittedBase,
        status: SubmissionStatus.SUBMITTED_WAITING,
        classAssignment: {
          ...submittedBase.classAssignment,
          dueAt: new Date(Date.now() - 10_000),
        },
      } as never);
      await expect(
        service.reopenSubmission('sub-1', { reason: 'Quá hạn' }, teacher),
      ).rejects.toThrowError(
        new BadRequestException('Bài tập đã quá hạn, vui lòng chọn hạn nộp mới'),
      );
    });

    it('marks old submission SUPERSEDED, logs reopen, clones answers into Attempt #2, writes audit log', async () => {
      const prisma = makeMockPrisma();
      const service = new AssignmentDeliveryService(prisma as never, accessPolicy);
      const newDueAt = futureIso(72);

      prisma.tx.class.findUnique.mockResolvedValueOnce({
        id: 'cls-1',
        code: 'HSK1-A',
        teacherId: 'teacher-1',
        courseId: 'course-1',
        status: ClassStatus.ACTIVE,
        course: { name: 'HSK 1' },
        teacherHistory: [],
      } as never);
      prisma.tx.submission.findUnique.mockResolvedValueOnce({
        id: 'sub-1',
        classAssignmentId: 'assign-1',
        studentId: 's-1',
        attemptNumber: 1,
        status: SubmissionStatus.SUBMITTED_WAITING,
        answers: [
          {
            questionId: 'q-1',
            answerPayload: { selectedOptionIds: ['a'] },
            audioPlayCount: 2,
          },
        ],
        student: { id: 's-1', fullName: 'An', email: 'an@webedu.vn' },
        classAssignment: {
          id: 'assign-1',
          classId: 'cls-1',
          dueAt: new Date(Date.now() - 10_000),
          effectiveDurationMinutes: 25,
          assessment: { questions: [{ id: 'q-1' }, { id: 'q-2' }] },
        },
      } as never);
      prisma.tx.submission.aggregate.mockResolvedValueOnce({
        _max: { attemptNumber: 1 },
      } as never);
      prisma.tx.submission.create.mockResolvedValueOnce({
        id: 'sub-2',
        attemptNumber: 2,
        status: SubmissionStatus.IN_PROGRESS,
        gradingStatus: GradingStatus.NONE,
      } as never);
      prisma.tx.submission.findMany.mockResolvedValueOnce([
        {
          id: 'sub-1',
          attemptNumber: 1,
          status: SubmissionStatus.SUPERSEDED,
          startedAt: new Date('2026-11-14T10:00:00.000Z'),
          lastSavedAt: new Date('2026-11-14T10:10:00.000Z'),
          submittedAt: new Date('2026-11-14T10:10:00.000Z'),
          autoSubmitted: false,
          elapsedSeconds: 600,
          remainingSeconds: 900,
          answers: [{ answerPayload: { selectedOptionIds: ['a'] } }],
          reopenLogs: [
            {
              reason: 'Học viên mất kết nối',
              reopenedAt: new Date('2026-11-14T11:00:00.000Z'),
            },
          ],
        },
        {
          id: 'sub-2',
          attemptNumber: 2,
          status: SubmissionStatus.IN_PROGRESS,
          startedAt: new Date('2026-11-14T11:00:00.000Z'),
          lastSavedAt: new Date('2026-11-14T11:00:00.000Z'),
          submittedAt: null,
          autoSubmitted: false,
          elapsedSeconds: 0,
          remainingSeconds: 1500,
          answers: [{ answerPayload: { selectedOptionIds: ['a'] } }],
          reopenLogs: [],
        },
      ] as never);

      const row = await service.reopenSubmission(
        'sub-1',
        { reason: '  Học viên mất kết nối  ', newDueAt },
        teacher,
      );

      expect(prisma.tx.classAssignment.update).toHaveBeenCalledWith({
        where: { id: 'assign-1' },
        data: { dueAt: new Date(newDueAt) },
      });
      expect(prisma.tx.submissionReopenLog.create).toHaveBeenCalledWith({
        data: {
          submissionId: 'sub-1',
          reopenedById: 'teacher-1',
          reason: 'Học viên mất kết nối',
        },
      });
      expect(prisma.tx.submission.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: SubmissionStatus.SUPERSEDED },
      });
      expect(prisma.tx.submission.create).toHaveBeenCalledWith({
        data: {
          classAssignmentId: 'assign-1',
          studentId: 's-1',
          attemptNumber: 2,
          status: SubmissionStatus.IN_PROGRESS,
          gradingStatus: GradingStatus.NONE,
          elapsedSeconds: 0,
          remainingSeconds: 1500,
        },
      });
      expect(prisma.tx.submissionAnswer.createMany).toHaveBeenCalledWith({
        data: [
          {
            submissionId: 'sub-2',
            questionId: 'q-1',
            answerPayload: { selectedOptionIds: ['a'] },
            audioPlayCount: 2,
            isCorrect: null,
            earnedPoints: null,
            aiFeedback: null,
            teacherComment: null,
          },
        ],
      });
      expect(prisma.tx.systemAuditLog.create).toHaveBeenCalled();
      expect(row.attemptNumber).toBe(2);
      expect(row.status).toBe(SubmissionStatus.IN_PROGRESS);
      expect(row.canReopen).toBe(false);
      expect(row.reopenCount).toBe(1);
      expect(row.supersededAttempts).toHaveLength(1);
      expect(row.supersededAttempts[0]?.reopenReason).toBe('Học viên mất kết nối');
    });
  });
});
