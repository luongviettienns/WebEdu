import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  ClassStatus,
  EnrollmentStatus,
  Role,
  SessionChangeAction,
  SessionStatus,
  SessionType,
  UserStatus,
} from '@prisma/client';
import { vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { toLessonSessionItemDto, type LessonSessionEntity } from '../mappers/session.mapper.js';
import { ScheduleAccessPolicy } from '../policies/schedule-access.policy.js';
import { SessionGeneratorService } from './session-generator.service.js';
import { SessionWorkflowService } from './session-workflow.service.js';

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

describe('SessionWorkflowService & ScheduleAccessPolicy (TDD Slice 4.2)', () => {
  const adminActor = makeActor('admin-1', [Role.ADMIN], 'Nguyễn Admin');
  const teacherActor = makeActor('teacher-1', [Role.TEACHER], 'Trương Mỹ Lan');
  const otherTeacher = makeActor('teacher-2', [Role.TEACHER], 'Lý Giáo Viên');
  const studentActor = makeActor('student-1', [Role.STUDENT], 'Trần Học Viên');
  const superadminOnly = makeActor('sa-1', [Role.SUPERADMIN], 'Superadmin');

  let accessPolicy: ScheduleAccessPolicy;
  let generatorMock: { renumberActiveSessionsAndSyncExpectedEndDate: ReturnType<typeof vi.fn> };
  let sessionsStore: Map<string, Record<string, unknown>>;
  let changeLogs: Array<Record<string, unknown>>;
  let mockPrisma: Record<string, unknown>;
  let workflow: SessionWorkflowService;

  beforeEach(() => {
    accessPolicy = new ScheduleAccessPolicy();
    changeLogs = [];
    sessionsStore = new Map([
      [
        'sess-1',
        {
          id: 'sess-1',
          classId: 'class-1',
          sessionNumber: 1,
          type: SessionType.REGULAR,
          sessionDate: new Date('2026-12-01T00:00:00.000Z'),
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
          createdAt: new Date('2026-11-10T08:00:00.000Z'),
          updatedAt: new Date('2026-11-10T08:00:00.000Z'),
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
        },
      ],
      [
        'sess-2',
        {
          id: 'sess-2',
          classId: 'class-1',
          sessionNumber: 2,
          type: SessionType.REGULAR,
          sessionDate: new Date('2026-12-03T00:00:00.000Z'),
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
          createdAt: new Date('2026-11-10T08:00:00.000Z'),
          updatedAt: new Date('2026-11-10T08:00:00.000Z'),
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
        },
      ],
      [
        'sess-completed',
        {
          id: 'sess-completed',
          classId: 'class-1',
          sessionNumber: 3,
          type: SessionType.REGULAR,
          sessionDate: new Date('2026-11-01T00:00:00.000Z'),
          startTime: '18:00',
          endTime: '19:30',
          status: SessionStatus.COMPLETED,
          isRescheduled: false,
          isMakeup: false,
          makeupForSessionId: null,
          topic: null,
          cancelReason: null,
          cancelledAt: null,
          attendanceMarkedAt: new Date('2026-11-01T20:00:00.000Z'),
          createdAt: new Date('2026-11-01T08:00:00.000Z'),
          updatedAt: new Date('2026-11-01T20:00:00.000Z'),
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
        },
      ],
    ]);

    generatorMock = {
      renumberActiveSessionsAndSyncExpectedEndDate: vi.fn().mockResolvedValue(new Date('2026-12-20T00:00:00.000Z')),
    };

    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      class: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'class-1',
          code: 'HSK1-K26-01',
          teacherId: 'teacher-1',
          status: ClassStatus.ACTIVE,
          totalSessions: 24,
          expectedEndDate: new Date('2026-12-20T00:00:00.000Z'),
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          course: { name: 'Tiếng Trung HSK 1' },
          teacher: { id: 'teacher-1', fullName: 'Trương Mỹ Lan' },
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'class-1',
          code: 'HSK1-K26-01',
          teacherId: 'teacher-1',
          status: ClassStatus.ACTIVE,
          totalSessions: 24,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      enrollment: {
        findFirst: vi.fn().mockImplementation(async ({ where }: { where: { studentId: string } }) =>
          where.studentId === 'student-1' ? { id: 'enr-1', status: 'ACTIVE' } : null,
        ),
      },
      lessonSession: {
        findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id?: string; makeupForSessionId?: string } }) => {
          if (where.id) return sessionsStore.get(where.id) ?? null;
          if (where.makeupForSessionId) {
            for (const s of sessionsStore.values()) {
              if (s.makeupForSessionId === where.makeupForSessionId) return s;
            }
          }
          return null;
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: { where: { id?: string; makeupForSessionId?: string } }) => {
          if (where.id && sessionsStore.has(where.id)) return sessionsStore.get(where.id)!;
          for (const s of sessionsStore.values()) {
            if (where.makeupForSessionId && s.makeupForSessionId === where.makeupForSessionId) return s;
          }
          throw new Error('Session not found in mock');
        }),
        findMany: vi.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.classId && typeof where.classId === 'object' && 'not' in where.classId) {
            return [];
          }
          const targetDate = where.sessionDate as Date | undefined;
          const excludeId =
            where.id && typeof where.id === 'object' && 'not' in where.id
              ? (where.id as { not: string }).not
              : undefined;
          return Array.from(sessionsStore.values()).filter((s) => {
            if (excludeId && s.id === excludeId) return false;
            if (s.status === SessionStatus.CANCELLED) return false;
            if (targetDate && (s.sessionDate as Date).getTime() !== targetDate.getTime()) return false;
            return true;
          });
        }),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          const id = data.isMakeup ? 'sess-makeup-1' : 'sess-manual-1';
          const row = {
            id,
            ...data,
            isRescheduled: false,
            isMakeup: Boolean(data.isMakeup),
            makeupForSessionId: (data.makeupForSessionId as string | null) ?? null,
            topic: (data.topic as string | null) ?? null,
            cancelReason: null,
            cancelledAt: null,
            attendanceMarkedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
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
          };
          sessionsStore.set(id, row);
          if (data.makeupForSessionId && sessionsStore.has(data.makeupForSessionId as string)) {
            sessionsStore.get(data.makeupForSessionId as string)!.makeupReplacement = { id };
          }
          return row;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = sessionsStore.get(where.id)!;
          Object.assign(existing, data);
          return existing;
        }),
        count: vi.fn().mockResolvedValue(3),
      },
      sessionChangeLog: {
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          changeLogs.push(data);
          return data;
        }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    };

    workflow = new SessionWorkflowService(
      mockPrisma as unknown as PrismaService,
      accessPolicy,
      generatorMock as unknown as SessionGeneratorService,
    );
  });

  it('enforces DEC-024 / DEC-025 / DEC-031 access rules across roles', async () => {
    await expect(
      accessPolicy.resolveClassScheduleViewerRole(mockPrisma as unknown as PrismaService, teacherActor, {
        id: 'class-1',
        teacherId: 'teacher-1',
      }),
    ).resolves.toBe('TEACHER');

    await expect(
      accessPolicy.resolveClassScheduleViewerRole(mockPrisma as unknown as PrismaService, otherTeacher, {
        id: 'class-1',
        teacherId: 'teacher-1',
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      accessPolicy.resolveClassScheduleViewerRole(mockPrisma as unknown as PrismaService, superadminOnly, {
        id: 'class-1',
        teacherId: 'teacher-1',
      }),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      workflow.rescheduleSession(teacherActor, 'sess-1', {
        sessionDate: '2026-12-10',
        startTime: '18:00',
        endTime: '19:30',
        reason: 'GV tự ý đổi',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects rescheduling COMPLETED session or into past dates or same-class overlapping slot', async () => {
    await expect(
      workflow.rescheduleSession(adminActor, 'sess-completed', {
        sessionDate: '2026-12-10',
        startTime: '18:00',
        endTime: '19:30',
        reason: 'Sửa buổi đã học',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      workflow.rescheduleSession(adminActor, 'sess-1', {
        sessionDate: '2020-01-01',
        startTime: '18:00',
        endTime: '19:30',
        reason: 'Đổi về quá khứ',
      }),
    ).rejects.toThrow(BadRequestException);

    // Overlaps with sess-2 on 2026-12-03 18:00-19:30
    await expect(
      workflow.rescheduleSession(adminActor, 'sess-1', {
        sessionDate: '2026-12-03',
        startTime: '19:00',
        endTime: '20:30',
        reason: 'Trùng giờ buổi 2',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('reschedules SCHEDULED session, marks isRescheduled=true, logs RESCHEDULE and renumbers', async () => {
    const res = await workflow.rescheduleSession(adminActor, 'sess-1', {
      sessionDate: '2026-12-15',
      startTime: '19:00',
      endTime: '20:30',
      reason: 'Nghỉ lễ trung tâm',
    });

    expect(res.session.isRescheduled).toBe(true);
    expect(res.session.sessionDate).toBe('2026-12-15');
    expect(generatorMock.renumberActiveSessionsAndSyncExpectedEndDate).toHaveBeenCalledTimes(1);
    expect(changeLogs[0]?.action).toBe(SessionChangeAction.RESCHEDULE);
    expect(changeLogs[0]?.reason).toBe('Nghỉ lễ trung tâm');
  });

  it('cancels session with sessionNumber=null, supports immediate makeup creation, and blocks double makeup', async () => {
    const cancelled = await workflow.cancelSession(adminActor, 'sess-1', {
      reason: 'Giáo viên ốm',
      makeup: {
        sessionDate: '2026-12-18',
        startTime: '18:00',
        endTime: '19:30',
      },
    });

    expect(cancelled.session.status).toBe(SessionStatus.CANCELLED);
    expect(cancelled.session.sessionNumber).toBeNull();
    expect(changeLogs.map((l) => l.action)).toEqual([
      SessionChangeAction.CANCEL,
      SessionChangeAction.ADD_MAKEUP,
    ]);

    // Attempting second makeup for same cancelled session must fail (FUNC-031)
    await expect(
      workflow.createMakeupSession(adminActor, 'sess-1', {
        sessionDate: '2026-12-19',
        startTime: '18:00',
        endTime: '19:30',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents Student from viewing ScheduleChangeLogs (FUNC-032)', () => {
    expect(() => accessPolicy.assertCanViewScheduleLogs(studentActor)).toThrow(ForbiddenException);
    expect(() => accessPolicy.assertCanViewScheduleLogs(superadminOnly)).not.toThrow();
  });

  it('REGRESSION (SEC-P4-05 & SEC-P4-03): rejects whitespace-only reasons, excludes DROPPED students, and masks STUDENT attendanceSummary', async () => {
    await expect(
      workflow.rescheduleSession(adminActor, 'sess-1', {
        sessionDate: '2026-12-15',
        startTime: '18:00',
        endTime: '19:30',
        reason: '   \t ',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      workflow.cancelSession(adminActor, 'sess-1', {
        reason: '   ',
      }),
    ).rejects.toThrow(BadRequestException);

    const findFirst = vi.fn().mockResolvedValue(null);
    await expect(
      accessPolicy.resolveClassScheduleViewerRole(
        { enrollment: { findFirst } } as unknown as PrismaService,
        studentActor,
        { id: 'class-1', teacherId: 'teacher-1' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        classId: 'class-1',
        studentId: studentActor.id,
        status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] },
      },
      select: { id: true, status: true },
    });

    const entity = {
      ...(sessionsStore.get('sess-completed') as Record<string, unknown>),
      attendanceRecords: [],
    } as unknown as LessonSessionEntity;
    const studentView = toLessonSessionItemDto(entity, studentActor, 'STUDENT', new Date());
    const adminView = toLessonSessionItemDto(entity, adminActor, 'ADMIN', new Date());
    expect(studentView.attendanceSummary).toBeNull();
    expect(adminView.attendanceSummary).not.toBeNull();
  });
});
