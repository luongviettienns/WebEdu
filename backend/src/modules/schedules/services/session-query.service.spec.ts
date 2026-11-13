import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AttendanceStatus,
  ClassStatus,
  Role,
  SessionChangeAction,
  SessionStatus,
  SessionType,
  UserStatus,
} from '@prisma/client';
import { vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { ScheduleAccessPolicy } from '../policies/schedule-access.policy.js';
import { SessionQueryService } from './session-query.service.js';

function makeActor(id: string, roles: Role[], fullName = 'Test Actor'): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    phone: '0900000001',
    fullName,
    roles,
    effectiveRole: roles[0]!,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    classId: 'class-1',
    sessionNumber: 1,
    type: SessionType.REGULAR,
    sessionDate: new Date('2099-12-01T00:00:00.000Z'),
    startTime: '18:00',
    endTime: '19:30',
    status: SessionStatus.SCHEDULED,
    isRescheduled: false,
    isMakeup: false,
    makeupForSessionId: null,
    topic: null,
    cancelReason: null,
    cancelledAt: null,
    attendanceMarkedAt: null,
    createdAt: new Date('2026-11-01T08:00:00.000Z'),
    updatedAt: new Date('2026-11-01T08:00:00.000Z'),
    class: {
      id: 'class-1',
      code: 'HSK1-K26-01',
      status: ClassStatus.ACTIVE,
      teacherId: 'teacher-1',
      course: { name: 'Tiếng Trung HSK 1' },
      teacher: { id: 'teacher-1', fullName: 'Trương Mỹ Lan' },
    },
    makeupForSession: null,
    makeupReplacement: null,
    attendanceRecords: [],
    changeLogs: [],
    ...overrides,
  };
}

describe('ScheduleAccessPolicy & SessionQueryService', () => {
  const adminActor = makeActor('admin-1', [Role.ADMIN], 'Nguyễn Admin');
  const multiRoleAdmin = makeActor('admin-2', [Role.TEACHER, Role.ADMIN], 'Teacher Admin');
  const teacherActor = makeActor('teacher-1', [Role.TEACHER], 'Trương Mỹ Lan');
  const otherTeacher = makeActor('teacher-2', [Role.TEACHER], 'Lý Giáo Viên');
  const studentActor = makeActor('student-1', [Role.STUDENT], 'Trần Học Viên');
  const superadminActor = makeActor('sa-1', [Role.SUPERADMIN], 'Superadmin');

  let accessPolicy: ScheduleAccessPolicy;
  let classFindUniqueMock: ReturnType<typeof vi.fn>;
  let enrollmentFindFirstMock: ReturnType<typeof vi.fn>;
  let enrollmentFindManyMock: ReturnType<typeof vi.fn>;
  let sessionFindManyMock: ReturnType<typeof vi.fn>;
  let sessionFindUniqueMock: ReturnType<typeof vi.fn>;
  let changeLogCountMock: ReturnType<typeof vi.fn>;
  let changeLogFindManyMock: ReturnType<typeof vi.fn>;
  let mockPrisma: PrismaService;
  let service: SessionQueryService;

  const baseClass = {
    id: 'class-1',
    code: 'HSK1-K26-01',
    status: ClassStatus.ACTIVE,
    teacherId: 'teacher-1',
    totalSessions: 4,
    startDate: new Date('2026-11-02T00:00:00.000Z'),
    expectedEndDate: new Date('2026-12-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    accessPolicy = new ScheduleAccessPolicy();
    classFindUniqueMock = vi.fn().mockResolvedValue(baseClass);
    enrollmentFindFirstMock = vi.fn().mockResolvedValue(null);
    enrollmentFindManyMock = vi.fn().mockResolvedValue([]);
    sessionFindManyMock = vi.fn().mockResolvedValue([]);
    sessionFindUniqueMock = vi.fn().mockResolvedValue(null);
    changeLogCountMock = vi.fn().mockResolvedValue(0);
    changeLogFindManyMock = vi.fn().mockResolvedValue([]);

    mockPrisma = {
      class: { findUnique: classFindUniqueMock },
      enrollment: {
        findFirst: enrollmentFindFirstMock,
        findMany: enrollmentFindManyMock,
      },
      lessonSession: {
        findMany: sessionFindManyMock,
        findUnique: sessionFindUniqueMock,
      },
      sessionChangeLog: {
        count: changeLogCountMock,
        findMany: changeLogFindManyMock,
      },
    } as unknown as PrismaService;

    service = new SessionQueryService(mockPrisma, accessPolicy);
  });

  describe('ScheduleAccessPolicy', () => {
    it('loadClassOrThrow throws NotFoundException when missing and returns class when present', async () => {
      classFindUniqueMock.mockResolvedValueOnce(null);
      await expect(accessPolicy.loadClassOrThrow(mockPrisma, 'missing')).rejects.toThrow(
        NotFoundException,
      );

      const loaded = await accessPolicy.loadClassOrThrow(mockPrisma, 'class-1');
      expect(loaded.id).toBe('class-1');
    });

    it('resolveClassScheduleViewerRole enforces ADMIN, lead TEACHER, enrolled STUDENT, and rejects others', async () => {
      await expect(
        accessPolicy.resolveClassScheduleViewerRole(mockPrisma, multiRoleAdmin, {
          id: 'class-1',
          teacherId: 'other',
        }),
      ).resolves.toBe('ADMIN');

      await expect(
        accessPolicy.resolveClassScheduleViewerRole(mockPrisma, teacherActor, {
          id: 'class-1',
          teacherId: 'teacher-1',
        }),
      ).resolves.toBe('TEACHER');

      await expect(
        accessPolicy.resolveClassScheduleViewerRole(mockPrisma, otherTeacher, {
          id: 'class-1',
          teacherId: 'teacher-1',
        }),
      ).rejects.toThrow(ForbiddenException);

      enrollmentFindFirstMock.mockResolvedValueOnce({ id: 'enr-1', status: 'ACTIVE' });
      await expect(
        accessPolicy.resolveClassScheduleViewerRole(mockPrisma, studentActor, {
          id: 'class-1',
          teacherId: 'teacher-1',
        }),
      ).resolves.toBe('STUDENT');

      enrollmentFindFirstMock.mockResolvedValueOnce(null);
      await expect(
        accessPolicy.resolveClassScheduleViewerRole(mockPrisma, studentActor, {
          id: 'class-1',
          teacherId: 'teacher-1',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        accessPolicy.resolveClassScheduleViewerRole(mockPrisma, superadminActor, {
          id: 'class-1',
          teacherId: 'teacher-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('assertAdminCanMutateSchedule allows ADMIN on ACTIVE/UPCOMING classes and rejects non-admin or closed classes', () => {
      expect(() =>
        accessPolicy.assertAdminCanMutateSchedule(adminActor, ClassStatus.ACTIVE),
      ).not.toThrow();
      expect(() =>
        accessPolicy.assertAdminCanMutateSchedule(teacherActor, ClassStatus.ACTIVE),
      ).toThrow(ForbiddenException);
      expect(() =>
        accessPolicy.assertAdminCanMutateSchedule(adminActor, ClassStatus.COMPLETED),
      ).toThrow(ForbiddenException);
      expect(() =>
        accessPolicy.assertAdminCanMutateSchedule(adminActor, ClassStatus.ARCHIVED),
      ).toThrow(ForbiddenException);
    });

    it('resolveCalendarClassScope resolves scopes for ADMIN, TEACHER, STUDENT and rejects unauthorized queries', async () => {
      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, adminActor, 'c-1', 't-1'),
      ).resolves.toEqual({ effectiveRole: 'ADMIN', classIds: ['c-1'], teacherId: 't-1' });
      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, adminActor),
      ).resolves.toEqual({ effectiveRole: 'ADMIN' });

      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, teacherActor),
      ).resolves.toEqual({ effectiveRole: 'TEACHER', teacherId: 'teacher-1' });

      classFindUniqueMock.mockResolvedValueOnce({ id: 'class-1', teacherId: 'teacher-1' });
      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, teacherActor, 'class-1'),
      ).resolves.toEqual({ effectiveRole: 'TEACHER', classIds: ['class-1'], teacherId: 'teacher-1' });

      classFindUniqueMock.mockResolvedValueOnce({ id: 'class-2', teacherId: 'teacher-2' });
      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, teacherActor, 'class-2'),
      ).rejects.toThrow(ForbiddenException);

      enrollmentFindManyMock.mockResolvedValueOnce([{ classId: 'class-1' }, { classId: 'class-2' }]);
      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, studentActor),
      ).resolves.toEqual({ effectiveRole: 'STUDENT', classIds: ['class-1', 'class-2'] });

      enrollmentFindManyMock.mockResolvedValueOnce([]);
      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, studentActor, 'class-9'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        accessPolicy.resolveCalendarClassScope(mockPrisma, superadminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('assertCanViewScheduleLogs allows ADMIN and SUPERADMIN and denies others', () => {
      expect(() => accessPolicy.assertCanViewScheduleLogs(adminActor)).not.toThrow();
      expect(() => accessPolicy.assertCanViewScheduleLogs(superadminActor)).not.toThrow();
      expect(() => accessPolicy.assertCanViewScheduleLogs(teacherActor)).toThrow(ForbiddenException);
      expect(() => accessPolicy.assertCanViewScheduleLogs(studentActor)).toThrow(ForbiddenException);
    });
  });

  describe('SessionQueryService', () => {
    it('listClassSessions computes summary counters across statuses and passes date/status filters', async () => {
      sessionFindManyMock.mockResolvedValueOnce([
        makeSessionRow({ id: 's1', status: SessionStatus.COMPLETED, attendanceRecords: [{ studentId: 'student-1', status: AttendanceStatus.PRESENT, note: null }] }),
        makeSessionRow({ id: 's2', status: SessionStatus.SCHEDULED, sessionDate: new Date('2020-01-01T00:00:00.000Z') }),
        makeSessionRow({ id: 's3', status: SessionStatus.CANCELLED, cancelReason: 'Nghỉ lễ' }),
        makeSessionRow({ id: 's4', status: SessionStatus.SCHEDULED, sessionDate: new Date('2099-12-10T00:00:00.000Z') }),
      ]);

      const res = await service.listClassSessions(teacherActor, 'class-1', {
        status: SessionStatus.SCHEDULED,
        from: '2026-11-01',
        to: '2026-11-30',
      });

      expect(res.classId).toBe('class-1');
      expect(res.effectiveRole).toBe('TEACHER');
      expect(res.summary).toEqual({
        totalSessionsTarget: 4,
        activeSessionsCount: 3,
        completedCount: 1,
        missedAttendanceCount: 1,
        upcomingCount: 1,
        cancelledCount: 1,
      });
      expect(sessionFindManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            classId: 'class-1',
            status: SessionStatus.SCHEDULED,
            sessionDate: {
              gte: new Date('2026-11-01T00:00:00.000Z'),
              lte: new Date('2026-11-30T00:00:00.000Z'),
            },
          }),
        }),
      );
    });

    it('getSessionDetail throws NotFoundException when missing and enforces viewer RBAC', async () => {
      sessionFindUniqueMock.mockResolvedValueOnce(null);
      await expect(service.getSessionDetail(adminActor, 'missing')).rejects.toThrow(NotFoundException);

      sessionFindUniqueMock.mockResolvedValueOnce(makeSessionRow());
      await expect(service.getSessionDetail(otherTeacher, 'sess-1')).rejects.toThrow(ForbiddenException);

      enrollmentFindFirstMock.mockResolvedValueOnce({ id: 'enr-1', status: 'ACTIVE' });
      sessionFindUniqueMock.mockResolvedValueOnce(
        makeSessionRow({
          status: SessionStatus.COMPLETED,
          attendanceRecords: [{ studentId: 'student-1', status: AttendanceStatus.EXCUSED, note: 'Xin phép' }],
        }),
      );
      const dto = await service.getSessionDetail(studentActor, 'sess-1');
      expect(dto.id).toBe('sess-1');
      expect(dto.myAttendanceStatus).toBe(AttendanceStatus.EXCUSED);
      expect(dto.attendanceSummary).toBeNull();
    });

    it('listCalendarSessions validates date ranges, short-circuits empty student enrollments, and maps results', async () => {
      await expect(
        service.listCalendarSessions(adminActor, { from: '2026-11-10', to: '2026-11-01' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.listCalendarSessions(adminActor, { from: '2026-01-01', to: '2026-06-01' }),
      ).rejects.toThrow(BadRequestException);

      enrollmentFindManyMock.mockResolvedValueOnce([]);
      const emptyRes = await service.listCalendarSessions(studentActor, {
        from: '2026-11-01',
        to: '2026-11-30',
      });
      expect(emptyRes).toEqual({
        effectiveRole: 'STUDENT',
        from: '2026-11-01',
        to: '2026-11-30',
        items: [],
      });
      expect(sessionFindManyMock).not.toHaveBeenCalled();

      sessionFindManyMock.mockResolvedValueOnce([makeSessionRow()]);
      const defaultRangeRes = await service.listCalendarSessions(adminActor, {
        status: SessionStatus.SCHEDULED,
      });
      expect(defaultRangeRes.effectiveRole).toBe('ADMIN');
      expect(defaultRangeRes.items).toHaveLength(1);
    });

    it('listScheduleChangeLogs rejects non-admins and applies VN timezone filters with pagination', async () => {
      await expect(service.listScheduleChangeLogs(teacherActor, {})).rejects.toThrow(ForbiddenException);

      changeLogCountMock.mockResolvedValueOnce(1);
      changeLogFindManyMock.mockResolvedValueOnce([
        {
          id: 'log-1',
          classId: 'class-1',
          sessionId: 'sess-1',
          action: SessionChangeAction.RESCHEDULE,
          actorId: 'admin-1',
          actorName: 'Nguyễn Admin',
          previousDate: new Date('2026-11-02T00:00:00.000Z'),
          previousStartTime: '18:00',
          previousEndTime: '19:30',
          newDate: new Date('2026-11-03T00:00:00.000Z'),
          newStartTime: '19:00',
          newEndTime: '20:30',
          reason: 'Đổi giờ học',
          createdAt: new Date('2026-11-01T10:00:00.000Z'),
          class: { code: 'HSK1-K26-01' },
          session: { sessionNumber: 1 },
        },
      ]);

      const logs = await service.listScheduleChangeLogs(superadminActor, {
        classId: 'class-1',
        action: SessionChangeAction.RESCHEDULE,
        from: '2026-11-01',
        to: '2026-11-30',
        page: 1,
        limit: 10,
      });
      expect(logs.total).toBe(1);
      expect(logs.items[0]?.actionLabel).toBe('Đổi lịch buổi');
      expect(logs.items[0]?.previousText).toContain('18:00–19:30');
    });
  });
});
