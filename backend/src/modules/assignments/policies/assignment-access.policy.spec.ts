import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, ClassStatus, EnrollmentStatus, Role, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AssignmentAccessPolicy, type DbClient } from './assignment-access.policy.js';

function makeActor(id: string, roles: Role[]): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    phone: '0900000001',
    fullName: id,
    roles,
    effectiveRole: roles[0] ?? Role.STUDENT,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

function makeClassRecord(overrides?: {
  teacherId?: string;
  coTeacherIds?: string[];
}) {
  return {
    id: 'class-1',
    code: 'HSK1-K26-01',
    teacherId: overrides?.teacherId ?? 'teacher-lead',
    courseId: 'course-1',
    status: ClassStatus.ACTIVE,
    course: { name: 'Tiếng Trung HSK 1' },
    ...(overrides?.coTeacherIds
      ? { teacherHistory: overrides.coTeacherIds.map((teacherId) => ({ teacherId })) }
      : {}),
  };
}

function makeDbMock(options: {
  classRecord?: ReturnType<typeof makeClassRecord> | null;
  enrollmentRecord?: { id: string; status: EnrollmentStatus } | null;
}) {
  const findUnique = vi.fn().mockResolvedValue(options.classRecord ?? null);
  const findFirst = vi.fn().mockResolvedValue(options.enrollmentRecord ?? null);

  const db = {
    class: { findUnique },
    enrollment: { findFirst },
  } as unknown as DbClient;

  return { db, findUnique, findFirst };
}

describe('AssignmentAccessPolicy', () => {
  const policy = new AssignmentAccessPolicy();

  describe('loadClassForAccess', () => {
    it('loads the class with course name without querying teacherHistory', async () => {
      const cls = makeClassRecord();
      const { db, findUnique } = makeDbMock({ classRecord: cls });

      const result = await policy.loadClassForAccess(db, 'class-1');

      expect(result).toEqual(cls);
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'class-1' },
        select: {
          id: true,
          code: true,
          teacherId: true,
          courseId: true,
          status: true,
          course: { select: { name: true } },
        },
      });
    });

    it('throws NotFoundException when the class does not exist', async () => {
      const { db } = makeDbMock({ classRecord: null });

      await expect(policy.loadClassForAccess(db, 'missing-class')).rejects.toThrowError(
        new NotFoundException('Không tìm thấy lớp học'),
      );
    });
  });

  describe('assertTeacherOrAdminCanAccessClass', () => {
    it('allows ADMIN regardless of class teacher assignment', async () => {
      const cls = makeClassRecord();
      const { db } = makeDbMock({ classRecord: cls });
      const admin = makeActor('admin-1', [Role.ADMIN]);

      const result = await policy.assertTeacherOrAdminCanAccessClass(db, admin, 'class-1');
      expect(result).toEqual(cls);
    });

    it('allows lead TEACHER matching class.teacherId', async () => {
      const cls = makeClassRecord({ teacherId: 'teacher-lead' });
      const { db } = makeDbMock({ classRecord: cls });
      const leadTeacher = makeActor('teacher-lead', [Role.TEACHER]);

      const result = await policy.assertTeacherOrAdminCanAccessClass(db, leadTeacher, 'class-1');
      expect(result).toEqual(cls);
    });

    it('rejects teacher present only in teacherHistory with 403 ForbiddenException (write requires current teacherId)', async () => {
      const cls = makeClassRecord({ teacherId: 'teacher-lead', coTeacherIds: ['teacher-co'] });
      const { db } = makeDbMock({ classRecord: cls });
      const coTeacher = makeActor('teacher-co', [Role.TEACHER]);

      await expect(
        policy.assertTeacherOrAdminCanAccessClass(db, coTeacher, 'class-1'),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền thao tác bài tập của lớp này'),
      );
    });

    it('rejects unrelated TEACHER with 403 ForbiddenException', async () => {
      const cls = makeClassRecord({ teacherId: 'teacher-lead', coTeacherIds: ['teacher-co'] });
      const { db } = makeDbMock({ classRecord: cls });
      const otherTeacher = makeActor('teacher-other', [Role.TEACHER]);

      await expect(
        policy.assertTeacherOrAdminCanAccessClass(db, otherTeacher, 'class-1'),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền thao tác bài tập của lớp này'),
      );
    });

    it('rejects STUDENT and pure SUPERADMIN with 403 ForbiddenException', async () => {
      const cls = makeClassRecord();
      const { db } = makeDbMock({ classRecord: cls });

      await expect(
        policy.assertTeacherOrAdminCanAccessClass(db, makeActor('stu-1', [Role.STUDENT]), 'class-1'),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền thao tác bài tập của lớp này'),
      );

      await expect(
        policy.assertTeacherOrAdminCanAccessClass(
          db,
          makeActor('sa-1', [Role.SUPERADMIN]),
          'class-1',
        ),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền thao tác bài tập của lớp này'),
      );
    });

    it('throws NotFoundException when class does not exist even for ADMIN', async () => {
      const { db } = makeDbMock({ classRecord: null });

      await expect(
        policy.assertTeacherOrAdminCanAccessClass(db, makeActor('admin-1', [Role.ADMIN]), 'missing'),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy lớp học'));
    });
  });

  describe('assertTeacherOrAdminCanReadClass', () => {
    it('allows ADMIN and current lead teacher, while rejecting former teacher in teacherHistory, unrelated teacher, and STUDENT', async () => {
      const cls = makeClassRecord({ teacherId: 'teacher-lead', coTeacherIds: ['teacher-co'] });
      const { db } = makeDbMock({ classRecord: cls });

      await expect(
        policy.assertTeacherOrAdminCanReadClass(db, makeActor('admin-1', [Role.ADMIN]), 'class-1'),
      ).resolves.toEqual(cls);
      await expect(
        policy.assertTeacherOrAdminCanReadClass(
          db,
          makeActor('teacher-lead', [Role.TEACHER]),
          'class-1',
        ),
      ).resolves.toEqual(cls);

      await expect(
        policy.assertTeacherOrAdminCanReadClass(
          db,
          makeActor('teacher-co', [Role.TEACHER]),
          'class-1',
        ),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'),
      );
      await expect(
        policy.assertTeacherOrAdminCanReadClass(
          db,
          makeActor('teacher-other', [Role.TEACHER]),
          'class-1',
        ),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'),
      );
      await expect(
        policy.assertTeacherOrAdminCanReadClass(
          db,
          makeActor('stu-1', [Role.STUDENT]),
          'class-1',
        ),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'),
      );
    });
  });

  describe('assertStudentEnrolledInClass', () => {
    it.each([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED])(
      'allows student with %s enrollment',
      async (status) => {
        const { db, findFirst } = makeDbMock({
          enrollmentRecord: { id: 'enr-1', status },
        });

        await expect(
          policy.assertStudentEnrolledInClass(db, 'student-1', 'class-1'),
        ).resolves.toBeUndefined();

        expect(findFirst).toHaveBeenCalledWith({
          where: {
            classId: 'class-1',
            studentId: 'student-1',
            status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
          },
          select: { id: true },
        });
      },
    );

    it('rejects non-enrolled, DROPPED, or TRANSFERRED student with 403 ForbiddenException', async () => {
      const { db } = makeDbMock({ enrollmentRecord: null });

      await expect(
        policy.assertStudentEnrolledInClass(db, 'student-dropped', 'class-1'),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền truy cập bài tập của lớp này'),
      );
    });
  });

  describe('resolveClassAssignmentViewer', () => {
    it('prioritizes ADMIN over TEACHER and STUDENT for multi-role actors', async () => {
      const cls = makeClassRecord({ teacherId: 'multi-1' });
      const { db, findFirst } = makeDbMock({
        classRecord: cls,
        enrollmentRecord: { id: 'enr-1', status: EnrollmentStatus.ACTIVE },
      });

      const res = await policy.resolveClassAssignmentViewer(
        db,
        makeActor('multi-1', [Role.STUDENT, Role.TEACHER, Role.ADMIN]),
        'class-1',
      );

      expect(res).toEqual({ role: 'ADMIN', cls });
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('prioritizes TEACHER over STUDENT when actor teaches the class', async () => {
      const cls = makeClassRecord({ teacherId: 'teacher-lead' });
      const { db, findFirst } = makeDbMock({
        classRecord: cls,
        enrollmentRecord: { id: 'enr-1', status: EnrollmentStatus.ACTIVE },
      });

      const res = await policy.resolveClassAssignmentViewer(
        db,
        makeActor('teacher-lead', [Role.STUDENT, Role.TEACHER]),
        'class-1',
      );

      expect(res).toEqual({ role: 'TEACHER', cls });
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('rejects former teacher in teacherHistory with 403 ForbiddenException when not current class teacher', async () => {
      const cls = makeClassRecord({ teacherId: 'teacher-lead', coTeacherIds: ['teacher-co'] });
      const { db } = makeDbMock({ classRecord: cls, enrollmentRecord: null });

      await expect(
        policy.resolveClassAssignmentViewer(
          db,
          makeActor('teacher-co', [Role.TEACHER]),
          'class-1',
        ),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'),
      );
    });

    it('falls back to STUDENT when multi-role TEACHER+STUDENT is not class teacher but is enrolled', async () => {
      const cls = makeClassRecord({ teacherId: 'someone-else' });
      const { db } = makeDbMock({
        classRecord: cls,
        enrollmentRecord: { id: 'enr-1', status: EnrollmentStatus.ACTIVE },
      });

      const res = await policy.resolveClassAssignmentViewer(
        db,
        makeActor('user-1', [Role.TEACHER, Role.STUDENT]),
        'class-1',
      );

      expect(res).toEqual({ role: 'STUDENT', cls });
    });

    it('resolves STUDENT when enrolled with ACTIVE or COMPLETED status', async () => {
      const cls = makeClassRecord();
      const { db } = makeDbMock({
        classRecord: cls,
        enrollmentRecord: { id: 'enr-1', status: EnrollmentStatus.COMPLETED },
      });

      const res = await policy.resolveClassAssignmentViewer(
        db,
        makeActor('student-1', [Role.STUDENT]),
        'class-1',
      );

      expect(res).toEqual({ role: 'STUDENT', cls });
    });

    it('throws 403 ForbiddenException for non-enrolled student, unrelated teacher, or pure SUPERADMIN', async () => {
      const cls = makeClassRecord();
      const { db } = makeDbMock({ classRecord: cls, enrollmentRecord: null });

      await expect(
        policy.resolveClassAssignmentViewer(db, makeActor('stu-out', [Role.STUDENT]), 'class-1'),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'),
      );

      await expect(
        policy.resolveClassAssignmentViewer(db, makeActor('t-out', [Role.TEACHER]), 'class-1'),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'),
      );

      await expect(
        policy.resolveClassAssignmentViewer(db, makeActor('sa-1', [Role.SUPERADMIN]), 'class-1'),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền xem bài tập của lớp này'),
      );
    });

    it('throws 404 NotFoundException when class is missing', async () => {
      const { db } = makeDbMock({ classRecord: null });

      await expect(
        policy.resolveClassAssignmentViewer(db, makeActor('admin-1', [Role.ADMIN]), 'missing'),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy lớp học'));
    });
  });

  describe('assertCanViewAssessment', () => {
    const draft = { id: 'asm-1', createdById: 'teacher-1', status: AssessmentStatus.DRAFT };
    const published = { id: 'asm-2', createdById: 'teacher-1', status: AssessmentStatus.PUBLISHED };

    it('throws 404 when assessment is null', () => {
      expect(() =>
        policy.assertCanViewAssessment(makeActor('admin-1', [Role.ADMIN]), null),
      ).toThrowError(new NotFoundException('Không tìm thấy đề'));
    });

    it('allows ADMIN to view any draft or published assessment', () => {
      expect(() =>
        policy.assertCanViewAssessment(makeActor('admin-1', [Role.ADMIN]), draft),
      ).not.toThrow();
    });

    it('allows TEACHER to view own draft or any published assessment, but hides others drafts with 404', () => {
      expect(() =>
        policy.assertCanViewAssessment(makeActor('teacher-1', [Role.TEACHER]), draft),
      ).not.toThrow();
      expect(() =>
        policy.assertCanViewAssessment(makeActor('teacher-2', [Role.TEACHER]), published),
      ).not.toThrow();
      expect(() =>
        policy.assertCanViewAssessment(makeActor('teacher-2', [Role.TEACHER]), draft),
      ).toThrowError(new NotFoundException('Không tìm thấy đề'));
      expect(() =>
        policy.assertCanViewAssessment(makeActor('stu-1', [Role.STUDENT]), published),
      ).toThrowError(new NotFoundException('Không tìm thấy đề'));
    });
  });
});
