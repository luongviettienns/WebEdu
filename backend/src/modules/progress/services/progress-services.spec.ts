import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AssessmentType,
  AttendanceStatus,
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  SessionStatus,
  SubmissionStatus,
  UserStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { formatIsoDateUtc, resolveVnToday } from '../../../common/utils/timezone.util.js';
import { AttendancePolicy } from '../../attendance/policies/attendance.policy.js';
import { ClassAccessService } from '../../classes/services/class-access.service.js';
import { AdminOverviewService } from './admin-overview.service.js';
import { ClassProgressService } from './class-progress.service.js';
import { StudentProgressService } from './student-progress.service.js';

function makeActor(id: string, roles: Role[]): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    phone: '0900000001',
    fullName: id,
    roles,
    effectiveRole: roles[0]!,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('ProgressModule Services (StudentProgressService, ClassProgressService, AdminOverviewService)', () => {
  const attendancePolicy = new AttendancePolicy();
  const classAccessService = new ClassAccessService();

  const studentActor = makeActor('stu-1', [Role.STUDENT]);
  const teacherActor = makeActor('tea-1', [Role.TEACHER]);
  const otherTeacherActor = makeActor('tea-2', [Role.TEACHER]);
  const adminActor = makeActor('adm-1', [Role.ADMIN]);
  const superadminActor = makeActor('sa-1', [Role.SUPERADMIN]);

  describe('StudentProgressService', () => {
    let service: StudentProgressService;
    let mockPrisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

    const courseOld = {
      id: 'course-1',
      code: 'HSK1',
      name: 'Tiếng Trung HSK 1',
      level: CourseLevel.HSK1,
      miniTestWeight: 20,
      midtermWeight: 30,
      finalWeight: 50,
      passingScore: 5.0,
    };
    const courseActive = {
      id: 'course-2',
      code: 'HSK2',
      name: 'Tiếng Trung HSK 2',
      level: CourseLevel.HSK2,
      miniTestWeight: 30,
      midtermWeight: 0,
      finalWeight: 70,
      passingScore: 5.5,
    };

    const classOld = {
      id: 'class-old',
      code: 'HSK1-K25',
      status: ClassStatus.COMPLETED,
      totalSessions: 24,
      expectedEndDate: new Date('2026-06-01T00:00:00.000Z'),
      course: courseOld,
      teacher: { id: 'tea-old', fullName: 'Cô Mai' },
    };
    const classActive = {
      id: 'class-active',
      code: 'HSK2-K26',
      status: ClassStatus.ACTIVE,
      totalSessions: 20,
      expectedEndDate: new Date('2026-12-30T00:00:00.000Z'),
      course: courseActive,
      teacher: { id: 'tea-1', fullName: 'Cô Lan' },
    };

    let enrollmentsData: unknown[];
    let sessionsData: unknown[];
    let attendanceData: unknown[];
    let assignmentsData: unknown[];
    let submissionsData: unknown[];
    let completedGroupByData: unknown[];

    beforeEach(() => {
      enrollmentsData = [
        {
          id: 'enr-old',
          classId: classOld.id,
          studentId: studentActor.id,
          status: EnrollmentStatus.COMPLETED,
          enrolledDate: new Date('2026-01-10T00:00:00.000Z'),
          leftDate: new Date('2026-06-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-10T00:00:00.000Z'),
          class: classOld,
        },
        {
          id: 'enr-active',
          classId: classActive.id,
          studentId: studentActor.id,
          status: EnrollmentStatus.ACTIVE,
          enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
          leftDate: null,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          class: classActive,
        },
      ];

      const todayVn = resolveVnToday(new Date());
      const tomorrowVn = new Date(todayVn.getTime() + 86_400_000);
      sessionsData = [
        {
          id: 'sess-1',
          classId: classActive.id,
          sessionNumber: 1,
          sessionDate: new Date('2026-10-02T00:00:00.000Z'),
          startTime: '18:00',
          endTime: '19:30',
          status: SessionStatus.COMPLETED,
          isMakeup: false,
        },
        {
          id: 'sess-2',
          classId: classActive.id,
          sessionNumber: 2,
          sessionDate: tomorrowVn,
          startTime: '18:00',
          endTime: '19:30',
          status: SessionStatus.SCHEDULED,
          isMakeup: false,
        },
      ];
      attendanceData = [
        { sessionId: 'sess-1', status: AttendanceStatus.PRESENT },
      ];
      assignmentsData = [
        {
          id: 'asg-mt',
          classId: classActive.id,
          assignedAt: new Date('2026-10-05T03:00:00.000Z'),
          dueAt: new Date('2026-10-08T10:00:00.000Z'),
          assessment: {
            title: 'Mini Test 1',
            type: AssessmentType.MINI_TEST,
            questions: [{ points: 10 }, { points: 10 }],
          },
        },
        {
          id: 'asg-fin-graded',
          classId: classActive.id,
          assignedAt: new Date('2026-10-10T03:00:00.000Z'),
          dueAt: new Date('2026-10-15T10:00:00.000Z'),
          assessment: {
            title: 'Final Exam',
            type: AssessmentType.FINAL,
            questions: [{ points: 10 }],
          },
        },
        {
          id: 'asg-hw',
          classId: classActive.id,
          assignedAt: new Date('2026-10-03T03:00:00.000Z'),
          dueAt: new Date('2026-10-06T10:00:00.000Z'),
          assessment: {
            title: 'BTVN Bài 1',
            type: AssessmentType.HOMEWORK,
            questions: [{ points: 10 }],
          },
        },
      ];
      submissionsData = [
        {
          id: 'sub-mt',
          classAssignmentId: 'asg-mt',
          status: SubmissionStatus.RETURNED,
          totalScore: 16,
          submittedAt: new Date('2026-10-07T08:00:00.000Z'),
          returnedAt: new Date('2026-10-09T08:00:00.000Z'),
          teacherFeedback: 'Tốt',
        },
        // GRADED but NOT RETURNED -> MUST NOT LEAK!
        {
          id: 'sub-fin',
          classAssignmentId: 'asg-fin-graded',
          status: SubmissionStatus.GRADED,
          totalScore: 9,
          submittedAt: new Date('2026-10-14T08:00:00.000Z'),
          returnedAt: null,
          teacherFeedback: 'Secret draft',
        },
        {
          id: 'sub-hw',
          classAssignmentId: 'asg-hw',
          status: SubmissionStatus.SUBMITTED_WAITING,
          totalScore: null,
          submittedAt: new Date('2026-10-05T08:00:00.000Z'),
          returnedAt: null,
          teacherFeedback: null,
        },
      ];
      completedGroupByData = [
        { classId: classOld.id, _count: { _all: 24 } },
        { classId: classActive.id, _count: { _all: 1 } },
      ];

      mockPrisma = {
        enrollment: {
          findMany: vi.fn(async () => enrollmentsData),
        },
        lessonSession: {
          findMany: vi.fn(async () => sessionsData),
          groupBy: vi.fn(async () => completedGroupByData),
        },
        attendanceRecord: {
          findMany: vi.fn(async () => attendanceData),
        },
        classAssignment: {
          findMany: vi.fn(async () => assignmentsData),
        },
        submission: {
          findMany: vi.fn(async () => submissionsData),
        },
      };

      service = new StudentProgressService(
        mockPrisma as unknown as PrismaService,
        attendancePolicy,
      );
    });

    it('selects ACTIVE primary class by default, blocks non-RETURNED grades (Zero-Leak), and preserves classHistory', async () => {
      const res = await service.getMyProgress(studentActor, {});

      expect(res.selectedClass?.classId).toBe(classActive.id);
      expect(res.selectedClass?.completedSessionsCount).toBe(1);
      expect(res.selectedClass?.remainingSessionsCount).toBe(19);
      expect(res.selectedClass?.progressPercent).toBe(5);
      expect(res.selectedClass?.nextSession?.id).toBe('sess-2');

      expect(res.gradingFormula).toEqual({
        miniTestWeight: 30,
        midtermWeight: 0,
        finalWeight: 70,
        passingScore: 5.5,
      });

      expect(res.attendance?.presentCount).toBe(1);
      expect(res.attendance?.attendanceRatePercent).toBe(100);

      // Zero-Leak: GRADED final exam must NOT appear in publishedResults or finalAvg
      expect(res.academicSummary?.miniTestAvg).toBe(8.0);
      expect(res.academicSummary?.finalAvg).toBeNull();
      expect(res.academicSummary?.finalScore).toBeNull();
      expect(res.academicSummary?.passStatus).toBe('INSUFFICIENT_DATA');
      expect(res.academicSummary?.homeworkStats).toEqual({
        submittedCount: 1,
        givenCount: 1,
        submissionRatePercent: 100,
        averageScore10: null,
      });
      expect(res.publishedResults).toHaveLength(1);
      expect(res.publishedResults[0]?.assignmentId).toBe('asg-mt');
      expect(res.publishedResults[0]?.score10).toBe(8);

      expect(res.classHistory).toHaveLength(2);
      expect(res.classHistory.map((h) => h.classId)).toContain(classOld.id);
    });

    it('isolates data to requested ?classId and throws ForbiddenException for foreign/un-enrolled classId', async () => {
      await expect(
        service.getMyProgress(studentActor, { classId: 'foreign-class-id' }),
      ).rejects.toThrow(ForbiddenException);

      const resOld = await service.getMyProgress(studentActor, { classId: classOld.id });
      expect(resOld.selectedClass?.classId).toBe(classOld.id);
      expect(resOld.selectedClass?.enrollmentStatus).toBe(EnrollmentStatus.COMPLETED);
    });

    it('handles student with no enrollments cleanly (PENDING_CLASS empty state)', async () => {
      enrollmentsData = [];
      const res = await service.getMyProgress(studentActor, {});

      expect(res).toEqual({
        selectedClass: null,
        gradingFormula: null,
        attendance: null,
        academicSummary: null,
        publishedResults: [],
        classHistory: [],
      });

      await expect(
        service.getMyProgress(studentActor, { classId: classActive.id }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ClassProgressService', () => {
    let service: ClassProgressService;
    let mockPrisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

    const clsEntity = {
      id: 'cls-1',
      code: 'HSK2-01',
      status: ClassStatus.ACTIVE,
      teacherId: teacherActor.id,
      totalSessions: 10,
      expectedEndDate: new Date('2026-12-20T00:00:00.000Z'),
      course: {
        miniTestWeight: 20,
        midtermWeight: 30,
        finalWeight: 50,
        passingScore: 5.0,
      },
      teacher: { fullName: 'Cô Lan' },
    };

    beforeEach(() => {
      const todayVn = resolveVnToday(new Date());
      const tomorrowVn = new Date(todayVn.getTime() + 86_400_000);

      mockPrisma = {
        class: {
          findUnique: vi.fn(async () => clsEntity),
        },
        enrollment: {
          // Student B has 2 enrollment rows in the same class (re-enrolled) -> 1 row, interval check!
          findMany: vi.fn(async () => [
            {
              id: 'e-a',
              classId: 'cls-1',
              studentId: 'stu-a',
              status: EnrollmentStatus.ACTIVE,
              enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
              leftDate: null,
              student: { id: 'stu-a', fullName: 'Nguyễn Văn An', email: 'an@webedu.vn' },
            },
            {
              id: 'e-b-old',
              classId: 'cls-1',
              studentId: 'stu-b',
              status: EnrollmentStatus.DROPPED,
              enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
              leftDate: new Date('2026-10-05T00:00:00.000Z'),
              student: { id: 'stu-b', fullName: 'Trần Thị Bình', email: 'binh@webedu.vn' },
            },
            {
              id: 'e-b-new',
              classId: 'cls-1',
              studentId: 'stu-b',
              status: EnrollmentStatus.ACTIVE,
              enrolledDate: new Date('2026-10-12T00:00:00.000Z'),
              leftDate: null,
              student: { id: 'stu-b', fullName: 'Trần Thị Bình', email: 'binh@webedu.vn' },
            },
          ]),
        },
        lessonSession: {
          findMany: vi.fn(async () => [
            {
              id: 's-1',
              sessionNumber: 1,
              sessionDate: new Date('2026-10-02T00:00:00.000Z'),
              startTime: '18:00',
              endTime: '19:30',
              status: SessionStatus.COMPLETED,
              isMakeup: false,
            },
            {
              id: 's-2',
              sessionNumber: 2,
              sessionDate: new Date('2026-10-04T00:00:00.000Z'),
              startTime: '18:00',
              endTime: '19:30',
              status: SessionStatus.COMPLETED,
              isMakeup: false,
            },
            {
              id: 's-3',
              sessionNumber: 3,
              sessionDate: new Date('2026-10-08T00:00:00.000Z'), // While Student B was dropped!
              startTime: '18:00',
              endTime: '19:30',
              status: SessionStatus.COMPLETED,
              isMakeup: false,
            },
            {
              id: 's-4',
              sessionNumber: 4,
              sessionDate: tomorrowVn,
              startTime: '18:00',
              endTime: '19:30',
              status: SessionStatus.SCHEDULED,
              isMakeup: false,
            },
          ]),
        },
        attendanceRecord: {
          findMany: vi.fn(async () => [
            // Student A: 3 absences out of totalSessions 10 -> 30% warning -> isAtRisk = true!
            { sessionId: 's-1', studentId: 'stu-a', status: AttendanceStatus.ABSENT },
            { sessionId: 's-2', studentId: 'stu-a', status: AttendanceStatus.ABSENT },
            { sessionId: 's-3', studentId: 'stu-a', status: AttendanceStatus.EXCUSED },
            // Student B: present on s-1, s-2; s-3 outside interval so ignored
            { sessionId: 's-1', studentId: 'stu-b', status: AttendanceStatus.PRESENT },
            { sessionId: 's-2', studentId: 'stu-b', status: AttendanceStatus.PRESENT },
            { sessionId: 's-3', studentId: 'stu-b', status: AttendanceStatus.ABSENT },
          ]),
        },
        classAssignment: {
          findMany: vi.fn(async () => [
            // Homework 1: eligible for both A & B
            {
              id: 'asg-hw-1',
              assignedAt: new Date('2026-10-02T03:00:00.000Z'),
              dueAt: new Date('2026-10-04T10:00:00.000Z'),
              assessment: { type: AssessmentType.HOMEWORK, questions: [{ points: 10 }] },
            },
            // Homework 2: assigned & due while Student B was dropped (Oct 7..Oct 10) -> NOT eligible for B unless submitted!
            {
              id: 'asg-hw-2',
              assignedAt: new Date('2026-10-07T03:00:00.000Z'),
              dueAt: new Date('2026-10-10T10:00:00.000Z'),
              assessment: { type: AssessmentType.HOMEWORK, questions: [{ points: 10 }] },
            },
            // Mini-test
            {
              id: 'asg-mt',
              assignedAt: new Date('2026-10-13T03:00:00.000Z'),
              dueAt: new Date('2026-10-15T10:00:00.000Z'),
              assessment: { type: AssessmentType.MINI_TEST, questions: [{ points: 20 }] },
            },
          ]),
        },
        submission: {
          findMany: vi.fn(async () => [
            // Student A submitted hw-1 & hw-2 (100% HW) -> still atRisk via 30% absence warning
            {
              classAssignmentId: 'asg-hw-1',
              studentId: 'stu-a',
              status: SubmissionStatus.RETURNED,
              totalScore: 8,
              submittedAt: new Date('2026-10-03T10:00:00.000Z'),
            },
            {
              classAssignmentId: 'asg-hw-2',
              studentId: 'stu-a',
              status: SubmissionStatus.SUBMITTED_WAITING,
              totalScore: null,
              submittedAt: new Date('2026-10-09T10:00:00.000Z'),
            },
            // Student A GRADED mini-test -> must NOT leak even in ClassProgressReportDto
            {
              classAssignmentId: 'asg-mt',
              studentId: 'stu-a',
              status: SubmissionStatus.GRADED,
              totalScore: 18,
              submittedAt: new Date('2026-10-14T10:00:00.000Z'),
            },
            // Student B did NOT submit hw-1 -> 0/1 = 0% < 60% -> isAtRisk = true via homework!
          ]),
        },
      };

      service = new ClassProgressService(
        mockPrisma as unknown as PrismaService,
        classAccessService,
        attendancePolicy,
      );
    });

    it('enforces ClassAccessService authorization (403 for non-owner teacher, 404 for missing class)', async () => {
      await expect(service.getClassProgress(otherTeacherActor, 'cls-1')).rejects.toThrow(
        ForbiddenException,
      );

      mockPrisma.class.findUnique.mockResolvedValueOnce(null);
      await expect(service.getClassProgress(adminActor, 'missing-cls')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('batches queries per class (omitting historical classes), respects enrollment intervals, and computes isAtRisk accurately', async () => {
      const report = await service.getClassProgress(teacherActor, 'cls-1');

      expect(report.classSummary.completedSessionsCount).toBe(3);
      expect(report.classSummary.remainingSessionsCount).toBe(7);
      expect(report.classSummary.progressPercent).toBe(30);
      expect(report.classSummary.nextSession?.id).toBe('s-4');
      expect(report.students).toHaveLength(2);

      // Strictly 1 batched findMany per table, scoped to classId!
      expect(mockPrisma.enrollment.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { classId: 'cls-1' } }),
      );
      expect(mockPrisma.submission.findMany).toHaveBeenCalledTimes(1);

      const stuA = report.students.find((s) => s.studentId === 'stu-a')!;
      expect(stuA.absencesCount).toBe(3);
      expect(stuA.isAt30PercentWarning).toBe(true);
      expect(stuA.homeworkGivenCount).toBe(2);
      expect(stuA.homeworkSubmittedCount).toBe(2);
      expect(stuA.homeworkSubmissionRatePercent).toBe(100);
      expect(stuA.miniTestAvg).toBeNull(); // GRADED does not count
      expect(stuA.isAtRisk).toBe(true);

      const stuB = report.students.find((s) => s.studentId === 'stu-b')!;
      expect(stuB.enrollmentStatus).toBe(EnrollmentStatus.ACTIVE);
      expect(stuB.presentCount).toBe(2);
      expect(stuB.absencesCount).toBe(0); // s-3 was outside enrollment interval
      expect(stuB.attendanceRatePercent).toBe(100);
      expect(stuB.isAt30PercentWarning).toBe(false);
      expect(stuB.homeworkGivenCount).toBe(1); // asg-hw-2 excluded by interval!
      expect(stuB.homeworkSubmittedCount).toBe(0);
      expect(stuB.homeworkSubmissionRatePercent).toBe(0);
      expect(stuB.isAtRisk).toBe(true); // < 60% homework rate
    });
  });

  describe('AdminOverviewService', () => {
    let service: AdminOverviewService;
    let mockPrisma: Record<string, Record<string, ReturnType<typeof vi.fn>>>;

    beforeEach(() => {
      const todayVn = resolveVnToday(new Date());
      const plus2Days = new Date(todayVn.getTime() + 2 * 86_400_000);
      const plus5Days = new Date(todayVn.getTime() + 5 * 86_400_000);

      mockPrisma = {
        class: {
          count: vi
            .fn()
            .mockResolvedValueOnce(2) // activeClassesCount
            .mockResolvedValueOnce(1), // upcomingClassesCount
          findMany: vi.fn(async () => [
            {
              id: 'cls-1',
              code: 'HSK1-01',
              courseId: 'c-1',
              teacherId: 'tea-1',
              status: ClassStatus.ACTIVE,
              startDate: new Date('2026-10-01T00:00:00.000Z'),
              totalSessions: 10,
              expectedEndDate: new Date('2026-12-15T00:00:00.000Z'),
              course: { id: 'c-1', name: 'HSK 1' },
              teacher: { id: 'tea-1', fullName: 'Cô Lan' },
            },
          ]),
        },
        user: {
          count: vi
            .fn()
            .mockResolvedValueOnce(14) // activeStudentsCount
            .mockResolvedValueOnce(3), // pendingEnrollmentCount
          findMany: vi.fn(async () => [{ id: 'tea-1', fullName: 'Cô Lan' }]),
        },
        course: {
          findMany: vi.fn(async () => [{ id: 'c-1', code: 'HSK1', name: 'HSK 1' }]),
        },
        lessonSession: {
          findMany: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
            if (args?.where && 'classId' in args.where) {
              return [
                {
                  id: 'sess-done',
                  classId: 'cls-1',
                  sessionNumber: 1,
                  sessionDate: new Date('2026-10-02T00:00:00.000Z'),
                  startTime: '18:00',
                  endTime: '19:30',
                  status: SessionStatus.COMPLETED,
                  isMakeup: false,
                },
                {
                  id: 'sess-sched',
                  classId: 'cls-1',
                  sessionNumber: 2,
                  sessionDate: plus2Days,
                  startTime: '18:00',
                  endTime: '19:30',
                  status: SessionStatus.SCHEDULED,
                  isMakeup: false,
                },
              ];
            }
            return [
              {
                id: 'sess-today',
                classId: 'cls-1',
                sessionNumber: 2,
                sessionDate: todayVn,
                startTime: '18:00',
                endTime: '19:30',
                status: SessionStatus.SCHEDULED,
                isMakeup: false,
                class: {
                  code: 'HSK1-01',
                  course: { name: 'HSK 1' },
                  teacher: { fullName: 'Cô Lan' },
                },
              },
              {
                id: 'sess-upcoming',
                classId: 'cls-1',
                sessionNumber: 3,
                sessionDate: plus5Days,
                startTime: '18:00',
                endTime: '19:30',
                status: SessionStatus.SCHEDULED,
                isMakeup: true,
                class: {
                  code: 'HSK1-01',
                  course: { name: 'HSK 1' },
                  teacher: { fullName: 'Cô Lan' },
                },
              },
            ];
          }),
        },
        enrollment: {
          findMany: vi.fn(async () => [
            {
              classId: 'cls-1',
              studentId: 'stu-1',
              status: EnrollmentStatus.ACTIVE,
              enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
              leftDate: null,
            },
            {
              classId: 'cls-1',
              studentId: 'stu-2',
              status: EnrollmentStatus.ACTIVE,
              enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
              leftDate: null,
            },
          ]),
        },
        attendanceRecord: {
          findMany: vi.fn(async () => [
            // Eligible completed session records: 1 PRESENT, 1 ABSENT -> 50%
            { classId: 'cls-1', sessionId: 'sess-done', studentId: 'stu-1', status: AttendanceStatus.PRESENT },
            { classId: 'cls-1', sessionId: 'sess-done', studentId: 'stu-2', status: AttendanceStatus.ABSENT },
            // Ineligible (session is SCHEDULED, not COMPLETED) -> ignored!
            { classId: 'cls-1', sessionId: 'sess-sched', studentId: 'stu-1', status: AttendanceStatus.ABSENT },
          ]),
        },
      };

      service = new AdminOverviewService(
        mockPrisma as unknown as PrismaService,
        attendancePolicy,
      );
    });

    it('rejects non-ADMIN actors with ForbiddenException', async () => {
      await expect(service.getOverview(teacherActor, {})).rejects.toThrow(ForbiddenException);
      await expect(service.getOverview(studentActor, {})).rejects.toThrow(ForbiddenException);
      await expect(service.getOverview(superadminActor, {})).rejects.toThrow(ForbiddenException);
    });

    it('computes 5 KPIs, batched averageAttendanceRatePercent per class, todaySessions & upcoming 5-day sessions', async () => {
      const todayIso = formatIsoDateUtc(resolveVnToday(new Date()));
      const res = await service.getOverview(adminActor, {});

      expect(res.kpis).toEqual({
        activeClassesCount: 2,
        upcomingClassesCount: 1,
        activeStudentsCount: 14,
        pendingEnrollmentCount: 3,
        todaySessionsCount: 1,
      });

      expect(res.classes).toHaveLength(1);
      expect(res.classes[0]).toMatchObject({
        classId: 'cls-1',
        classCode: 'HSK1-01',
        enrolledCount: 2,
        completedSessionsCount: 1,
        totalSessions: 10,
        remainingSessionsCount: 9,
        progressPercent: 10,
        averageAttendanceRatePercent: 50,
      });
      expect(res.classes[0]?.nextSession?.id).toBe('sess-sched');

      expect(res.todaySessions).toHaveLength(1);
      expect(res.todaySessions[0]?.sessionDate).toBe(todayIso);
      expect(res.upcomingSessions).toHaveLength(1);
      expect(res.upcomingSessions[0]?.isMakeup).toBe(true);

      expect(res.filterOptions.courses).toHaveLength(1);
      expect(res.filterOptions.teachers).toHaveLength(1);
    });

    it('counts COMPLETED enrollments in enrolledCount for COMPLETED and ARCHIVED classes', async () => {
      (mockPrisma.class as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValueOnce([
        {
          id: 'cls-ended',
          code: 'HSK1-OLD',
          courseId: 'c-1',
          teacherId: 'tea-1',
          status: ClassStatus.COMPLETED,
          startDate: new Date('2026-06-01T00:00:00.000Z'),
          totalSessions: 24,
          expectedEndDate: new Date('2026-08-30T00:00:00.000Z'),
          course: { id: 'c-1', name: 'HSK 1' },
          teacher: { id: 'tea-1', fullName: 'Cô Lan' },
        },
      ]);
      (mockPrisma.lessonSession as { findMany: ReturnType<typeof vi.fn> }).findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      (mockPrisma.enrollment as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValueOnce([
        {
          classId: 'cls-ended',
          studentId: 'stu-1',
          status: EnrollmentStatus.COMPLETED,
          enrolledDate: new Date('2026-06-01T00:00:00.000Z'),
          leftDate: new Date('2026-08-30T00:00:00.000Z'),
        },
        {
          classId: 'cls-ended',
          studentId: 'stu-2',
          status: EnrollmentStatus.COMPLETED,
          enrolledDate: new Date('2026-06-01T00:00:00.000Z'),
          leftDate: new Date('2026-08-30T00:00:00.000Z'),
        },
        {
          classId: 'cls-ended',
          studentId: 'stu-3',
          status: EnrollmentStatus.DROPPED,
          enrolledDate: new Date('2026-06-01T00:00:00.000Z'),
          leftDate: new Date('2026-07-01T00:00:00.000Z'),
        },
      ]);
      (mockPrisma.attendanceRecord as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValueOnce([]);

      const res = await service.getOverview(adminActor, { includeEnded: true });
      expect(res.classes).toHaveLength(1);
      expect(res.classes[0]?.enrolledCount).toBe(2);
    });
  });
});
