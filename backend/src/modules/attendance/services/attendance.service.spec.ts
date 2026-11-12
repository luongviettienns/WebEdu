import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AttendanceStatus,
  ClassStatus,
  EnrollmentStatus,
  Role,
  SessionStatus,
  SessionType,
  UserStatus,
} from '@prisma/client';
import { vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { PrismaService } from '../../../common/prisma/prisma.service.js';
import { AttendancePolicy } from '../policies/attendance.policy.js';
import { AttendanceCrudService } from './attendance-crud.service.js';
import { AttendanceQueryService } from './attendance-query.service.js';

function makeActor(id: string, roles: Role[], fullName = id): AuthenticatedUser {
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

describe('AttendanceCrudService & AttendanceQueryService (TDD Slice 4.3-4.4)', () => {
  const adminActor = makeActor('admin-1', [Role.ADMIN], 'Nguyễn Admin');
  const teacherActor = makeActor('teacher-1', [Role.TEACHER], 'Trương Mỹ Lan');
  const student1 = makeActor('stu-1', [Role.STUDENT], 'Học Viên 1');
  const student2 = makeActor('stu-2', [Role.STUDENT], 'Học Viên 2');

  let sessionState: Record<string, unknown>;
  let attendanceRecords: Array<Record<string, unknown>>;
  let auditEntries: Array<Record<string, unknown>>;
  let mockPrisma: Record<string, unknown>;
  let queryService: AttendanceQueryService;
  let crudService: AttendanceCrudService;

  beforeEach(() => {
    attendanceRecords = [];
    auditEntries = [];
    sessionState = {
      id: 'sess-1',
      classId: 'class-1',
      sessionNumber: 1,
      type: SessionType.REGULAR,
      sessionDate: new Date('2026-11-12T00:00:00.000Z'),
      startTime: '18:00',
      endTime: '19:30',
      status: SessionStatus.SCHEDULED,
      attendanceMarkedById: null,
      attendanceMarkedAt: null,
      class: {
        id: 'class-1',
        code: 'HSK1-K26-01',
        status: ClassStatus.ACTIVE,
        teacherId: 'teacher-1',
        totalSessions: 24,
        course: { name: 'Tiếng Trung HSK 1' },
        teacher: { fullName: 'Trương Mỹ Lan' },
      },
      attendanceRecords,
      attendanceAudits: auditEntries,
    };

    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      class: {
        findUnique: vi.fn().mockResolvedValue(sessionState.class),
      },
      lessonSession: {
        findUnique: vi.fn().mockImplementation(async () => ({
          ...sessionState,
          attendanceRecords: [...attendanceRecords],
          attendanceAudits: [...auditEntries],
        })),
        findUniqueOrThrow: vi.fn().mockImplementation(async () => ({
          ...sessionState,
          attendanceRecords: [...attendanceRecords],
        })),
        findMany: vi.fn().mockImplementation(async () => [sessionState]),
        update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(sessionState, data);
          return sessionState;
        }),
      },
      enrollment: {
        findMany: vi.fn().mockResolvedValue([
          {
            studentId: 'stu-1',
            classId: 'class-1',
            status: EnrollmentStatus.ACTIVE,
            enrolledDate: new Date('2026-11-01T00:00:00.000Z'),
            leftDate: null,
            student: { id: 'stu-1', fullName: 'Học Viên 1', email: 's1@webedu.vn', phone: '0911111111' },
            class: {
              id: 'class-1',
              code: 'HSK1-K26-01',
              totalSessions: 24,
              course: { name: 'Tiếng Trung HSK 1' },
              teacher: { fullName: 'Trương Mỹ Lan' },
            },
          },
          {
            studentId: 'stu-2',
            classId: 'class-1',
            status: EnrollmentStatus.ACTIVE,
            enrolledDate: new Date('2026-11-01T00:00:00.000Z'),
            leftDate: null,
            student: { id: 'stu-2', fullName: 'Học Viên 2', email: 's2@webedu.vn', phone: '0922222222' },
            class: {
              id: 'class-1',
              code: 'HSK1-K26-01',
              totalSessions: 24,
              course: { name: 'Tiếng Trung HSK 1' },
              teacher: { fullName: 'Trương Mỹ Lan' },
            },
          },
        ]),
      },
      attendanceRecord: {
        findMany: vi.fn().mockImplementation(async () => attendanceRecords),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          const rec = {
            id: `att-${attendanceRecords.length + 1}`,
            ...data,
            updatedAt: new Date('2026-11-12T12:00:00.000Z'),
            markedBy: { fullName: teacherActor.fullName },
            updatedBy: null,
          };
          attendanceRecords.push(rec);
          return rec;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const rec = attendanceRecords.find((r) => r.id === where.id)!;
          Object.assign(rec, data, { updatedBy: { fullName: adminActor.fullName } });
          return rec;
        }),
      },
      attendanceAuditLog: {
        createMany: vi.fn().mockImplementation(async ({ data }: { data: Array<Record<string, unknown>> }) => {
          for (const d of data) {
            auditEntries.push({
              id: `aud-${auditEntries.length + 1}`,
              ...d,
              createdAt: new Date('2026-11-12T13:00:00.000Z'),
              student: { fullName: 'Học Viên 2' },
              actor: { fullName: adminActor.fullName },
            });
          }
          return { count: data.length };
        }),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T12:00:00.000Z'));

    const policy = new AttendancePolicy();
    queryService = new AttendanceQueryService(mockPrisma as unknown as PrismaService, policy);
    crudService = new AttendanceCrudService(
      mockPrisma as unknown as PrismaService,
      policy,
      queryService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requires 100% roster submission and transitions session status to COMPLETED on save', async () => {
    await expect(
      crudService.saveSessionAttendance(teacherActor, 'sess-1', {
        records: [{ studentId: 'stu-1', status: AttendanceStatus.PRESENT }],
      }),
    ).rejects.toThrow(BadRequestException);

    const sheet = await crudService.saveSessionAttendance(teacherActor, 'sess-1', {
      records: [
        { studentId: 'stu-1', status: AttendanceStatus.PRESENT },
        { studentId: 'stu-2', status: AttendanceStatus.ABSENT, note: 'Nghỉ không báo' },
      ],
    });

    expect(sheet.session.status).toBe(SessionStatus.COMPLETED);
    expect(sheet.summary).toEqual({
      totalStudents: 2,
      presentCount: 1,
      absentCount: 1,
      excusedCount: 0,
      unmarkedCount: 0,
    });
  });

  it('requires reason when modifying saved attendance and logs AttendanceAuditLog with isAdminOverride after T+2', async () => {
    await crudService.saveSessionAttendance(teacherActor, 'sess-1', {
      records: [
        { studentId: 'stu-1', status: AttendanceStatus.PRESENT },
        { studentId: 'stu-2', status: AttendanceStatus.ABSENT },
      ],
    });

    // Modifying within window without reason must throw BadRequestException
    await expect(
      crudService.saveSessionAttendance(teacherActor, 'sess-1', {
        records: [
          { studentId: 'stu-1', status: AttendanceStatus.PRESENT },
          { studentId: 'stu-2', status: AttendanceStatus.EXCUSED },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    // Move time past T+2 (2026-11-15 GMT+7)
    vi.setSystemTime(new Date('2026-11-15T05:00:00.000Z'));

    // Teacher blocked after 2-day window
    await expect(
      crudService.saveSessionAttendance(teacherActor, 'sess-1', {
        reason: 'Sửa muộn',
        records: [
          { studentId: 'stu-1', status: AttendanceStatus.PRESENT },
          { studentId: 'stu-2', status: AttendanceStatus.EXCUSED },
        ],
      }),
    ).rejects.toThrow(ForbiddenException);

    // Admin overrides with reason -> audit entry has isAdminOverride = true
    const overridden = await crudService.saveSessionAttendance(adminActor, 'sess-1', {
      reason: 'Phụ huynh gửi đơn xin phép bổ sung',
      records: [
        { studentId: 'stu-1', status: AttendanceStatus.PRESENT },
        { studentId: 'stu-2', status: AttendanceStatus.EXCUSED, note: 'Đã nộp phép' },
      ],
    });

    expect(overridden.auditLogs).toHaveLength(1);
    expect(overridden.auditLogs[0]?.isAdminOverride).toBe(true);
    expect(overridden.auditLogs[0]?.previousStatus).toBe(AttendanceStatus.ABSENT);
    expect(overridden.auditLogs[0]?.newStatus).toBe(AttendanceStatus.EXCUSED);
  });

  it('rejects Student reading foreign class attendance via /attendance/me?classId=foreign', async () => {
    await expect(
      queryService.getStudentMyAttendance(student1, { classId: 'foreign-class-id' }),
    ).rejects.toThrow(ForbiddenException);

    expect(student2.id).toBe('stu-2');
  });

  it('REGRESSION (SEC-P4-06): deduplicates re-enrolled student across sheet, matrix, and student views', async () => {
    const classMeta = {
      id: 'class-1',
      code: 'HSK1-K26-01',
      totalSessions: 24,
      course: { name: 'Tiếng Trung HSK 1' },
      teacher: { fullName: 'Trương Mỹ Lan' },
    };
    const findManyMock = (mockPrisma.enrollment as { findMany: ReturnType<typeof vi.fn> }).findMany;
    findManyMock.mockResolvedValue([
      {
        studentId: 'stu-1',
        classId: 'class-1',
        status: EnrollmentStatus.DROPPED,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        leftDate: new Date('2026-11-12T00:00:00.000Z'),
        student: { id: 'stu-1', fullName: 'Học Viên 1', email: 's1@webedu.vn', phone: '0911111111' },
        class: classMeta,
      },
      {
        studentId: 'stu-1',
        classId: 'class-1',
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-11-12T00:00:00.000Z'),
        leftDate: null,
        student: { id: 'stu-1', fullName: 'Học Viên 1', email: 's1@webedu.vn', phone: '0911111111' },
        class: classMeta,
      },
    ]);

    const sheet = await queryService.getSessionAttendanceSheet(teacherActor, 'sess-1');
    expect(sheet.roster).toHaveLength(1);

    const matrix = await queryService.getClassAttendanceMatrix(teacherActor, 'class-1');
    expect(matrix.students).toHaveLength(1);
    expect(matrix.students[0]?.enrollmentStatus).toBe(EnrollmentStatus.ACTIVE);

    const mine = await queryService.getStudentMyAttendance(student1, {});
    expect(mine.classes).toHaveLength(1);
    expect(mine.classes[0]?.enrollmentStatus).toBe(EnrollmentStatus.ACTIVE);
  });
});
