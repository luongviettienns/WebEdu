import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import {
  assertValidTimeRange,
  calculateExpectedEndDate,
  formatScheduleText,
  hasScheduleOverlap,
  normalizeScheduleDays,
} from './policies/class-schedule.util.js';
import { ClassCrudService } from './services/class-crud.service.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

interface MockCourse {
  id: string;
  code: string;
  name: string;
  level: CourseLevel;
  defaultSessions: number | null;
  isActive: boolean;
}

interface MockTeacherUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
}

interface MockClassRecord {
  id: string;
  code: string;
  courseId: string;
  teacherId: string;
  status: ClassStatus;
  startDate: Date;
  totalSessions: number;
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  expectedEndDate: Date | null;
  actualEndDate: Date | null;
  closedReason: string | null;
  closedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAssignmentRecord {
  id: string;
  classId: string;
  teacherId: string;
  assignedFrom: Date;
  assignedTo: Date | null;
  changedById: string | null;
  reason: string | null;
  createdAt: Date;
}

interface MockEnrollmentRecord {
  id: string;
  classId: string;
  studentId: string;
  status: EnrollmentStatus;
}

describe('ClassCrudService & class-schedule.util — Class Creation, Schedule Calculation & Teacher Assignment', () => {
  let service: ClassCrudService;
  let coursesStore: Map<string, MockCourse>;
  let usersStore: Map<string, MockTeacherUser>;
  let teacherProfileCounts: Map<string, number>;
  let classesStore: Map<string, MockClassRecord>;
  let assignmentsStore: MockAssignmentRecord[];
  let enrollmentsStore: MockEnrollmentRecord[];
  let auditLogs: Array<Record<string, unknown>>;
  let mockPrisma: Record<string, unknown>;

  const adminActor: AuthenticatedUser = {
    id: 'admin-01',
    email: 'admin@webedu.vn',
    fullName: 'Nguyễn Quản Trị Đào Tạo',
    phone: '0909000003',
    roles: [Role.ADMIN],
    effectiveRole: Role.ADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  // Ghim đồng hồ hệ thống để dữ liệu mẫu có ngày cố định không bị coi là 'tương lai' (GMT+7: 31/12/2026 12:00).
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-12-31T05:00:00.000Z'));
    coursesStore = new Map([
      [
        'course-hsk1',
        {
          id: 'course-hsk1',
          code: 'HSK1',
          name: 'Tiếng Trung HSK 1',
          level: CourseLevel.HSK1,
          defaultSessions: 24,
          isActive: true,
        },
      ],
      [
        'course-hsk2',
        {
          id: 'course-hsk2',
          code: 'HSK2',
          name: 'Tiếng Trung HSK 2',
          level: CourseLevel.HSK2,
          defaultSessions: 30,
          isActive: true,
        },
      ],
      [
        'course-inactive',
        {
          id: 'course-inactive',
          code: 'HSK-OLD',
          name: 'Khóa học cũ ngừng mở',
          level: CourseLevel.HSK1,
          defaultSessions: 20,
          isActive: false,
        },
      ],
    ]);

    usersStore = new Map([
      [
        'teacher-01',
        {
          id: 'teacher-01',
          fullName: 'Trương Giáo Viên',
          email: 'teacher01@webedu.vn',
          phone: '0901111111',
          roles: [Role.TEACHER],
          status: UserStatus.ACTIVE,
        },
      ],
      [
        'teacher-02',
        {
          id: 'teacher-02',
          fullName: 'Lý Giáo Viên',
          email: 'teacher02@webedu.vn',
          phone: '0902222222',
          roles: [Role.TEACHER],
          status: UserStatus.ACTIVE,
        },
      ],
      [
        'teacher-inactive',
        {
          id: 'teacher-inactive',
          fullName: 'Giáo Viên Nghỉ Việc',
          email: 'inactive@webedu.vn',
          phone: '0903333333',
          roles: [Role.TEACHER],
          status: UserStatus.INACTIVE,
        },
      ],
      [
        'student-01',
        {
          id: 'student-01',
          fullName: 'Học Viên A',
          email: 'student01@webedu.vn',
          phone: '0904444444',
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
        },
      ],
    ]);

    teacherProfileCounts = new Map([
      ['teacher-01', 0],
      ['teacher-02', 0],
    ]);
    classesStore = new Map();
    assignmentsStore = [];
    enrollmentsStore = [];
    auditLogs = [];

    const enrichClass = (cls: MockClassRecord) => {
      const course = coursesStore.get(cls.courseId)!;
      const teacher = usersStore.get(cls.teacherId)!;
      const classEnrollments = enrollmentsStore.filter(
        (e) => e.classId === cls.id,
      );
      const activeEnrollments = classEnrollments.filter(
        (e) => e.status === EnrollmentStatus.ACTIVE,
      );
      return {
        ...cls,
        course,
        teacher,
        enrollments: activeEnrollments.map((e) => ({ id: e.id })),
        _count: { enrollments: classEnrollments.length },
      };
    };

    mockPrisma = {
      $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        return [{ id: values[0] }];
      }),
      course: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return coursesStore.get(where.id) ?? null;
        }),
      },
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return usersStore.get(where.id) ?? null;
        }),
      },
      class: {
        findUnique: vi.fn(
          async ({
            where,
          }: {
            where: { id?: string; code?: string };
          }) => {
            if (where.id) {
              const found = classesStore.get(where.id);
              if (!found) return null;
              const enriched = enrichClass(found);
              return {
                ...enriched,
                enrollments: enrollmentsStore
                  .filter((e) => e.classId === found.id)
                  .map((e) => ({ id: e.id, status: e.status })),
              };
            }
            if (where.code) {
              for (const cls of classesStore.values()) {
                if (cls.code === where.code) {
                  return enrichClass(cls);
                }
              }
            }
            return null;
          },
        ),
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: { code?: string; id?: { not?: string } };
          }) => {
            for (const cls of classesStore.values()) {
              if (where.id?.not && cls.id === where.id.not) continue;
              if (where.code && cls.code === where.code) {
                return enrichClass(cls);
              }
            }
            return null;
          },
        ),
        findMany: vi.fn(
          async ({
            where,
          }: {
            where?: {
              teacherId?: string;
              id?: { not?: string };
              status?: { in?: ClassStatus[] };
            };
          } = {}) => {
            let list = Array.from(classesStore.values());
            if (where?.teacherId) {
              list = list.filter((c) => c.teacherId === where.teacherId);
            }
            if (where?.id?.not) {
              list = list.filter((c) => c.id !== where.id?.not);
            }
            if (where?.status?.in) {
              list = list.filter((c) => where.status!.in!.includes(c.status));
            }
            return list.map(enrichClass);
          },
        ),
        count: vi.fn(
          async ({
            where,
          }: {
            where: { teacherId: string; status: { in: ClassStatus[] } };
          }) => {
            let count = 0;
            for (const cls of classesStore.values()) {
              if (
                cls.teacherId === where.teacherId &&
                where.status.in.includes(cls.status)
              ) {
                count += 1;
              }
            }
            return count;
          },
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          for (const existing of classesStore.values()) {
            if (existing.code === data.code) {
              const err = new Error('Unique constraint failed') as Error & {
                code: string;
              };
              err.code = 'P2002';
              throw err;
            }
          }
          const now = new Date('2026-11-10T08:00:00.000Z');
          const created: MockClassRecord = {
            id: `class-${classesStore.size + 1}`,
            code: data.code as string,
            courseId: data.courseId as string,
            teacherId: data.teacherId as string,
            status: (data.status as ClassStatus) ?? ClassStatus.UPCOMING,
            startDate: data.startDate as Date,
            totalSessions: data.totalSessions as number,
            scheduleDays: data.scheduleDays as number[],
            scheduleStartTime: data.scheduleStartTime as string,
            scheduleEndTime: data.scheduleEndTime as string,
            expectedEndDate: (data.expectedEndDate as Date | null) ?? null,
            actualEndDate: null,
            closedReason: null,
            closedAt: null,
            notes: (data.notes as string | null) ?? null,
            createdAt: now,
            updatedAt: now,
          };
          classesStore.set(created.id, created);
          return enrichClass(created);
        }),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const existing = classesStore.get(where.id);
            if (!existing) throw new Error('Class not found');
            if (typeof data.code === 'string') existing.code = data.code;
            if (typeof data.courseId === 'string') {
              existing.courseId = data.courseId;
            }
            if (typeof data.teacherId === 'string') {
              existing.teacherId = data.teacherId;
            }
            if (typeof data.status === 'string') {
              existing.status = data.status as ClassStatus;
            }
            if (data.startDate instanceof Date) {
              existing.startDate = data.startDate;
            }
            if (typeof data.totalSessions === 'number') {
              existing.totalSessions = data.totalSessions;
            }
            if (Array.isArray(data.scheduleDays)) {
              existing.scheduleDays = data.scheduleDays as number[];
            }
            if (typeof data.scheduleStartTime === 'string') {
              existing.scheduleStartTime = data.scheduleStartTime;
            }
            if (typeof data.scheduleEndTime === 'string') {
              existing.scheduleEndTime = data.scheduleEndTime;
            }
            if ('expectedEndDate' in data) {
              existing.expectedEndDate =
                (data.expectedEndDate as Date | null) ?? null;
            }
            if ('notes' in data) {
              existing.notes = (data.notes as string | null) ?? null;
            }
            existing.updatedAt = new Date('2026-11-10T09:00:00.000Z');
            return enrichClass(existing);
          },
        ),
      },
      classTeacherAssignment: {
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: { classId: string; assignedTo?: null };
          }) => {
            return (
              assignmentsStore.find(
                (a) =>
                  a.classId === where.classId &&
                  (where.assignedTo === null ? a.assignedTo === null : true),
              ) ?? null
            );
          },
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const item: MockAssignmentRecord = {
            id: `assign-${assignmentsStore.length + 1}`,
            classId: data.classId as string,
            teacherId: data.teacherId as string,
            assignedFrom: data.assignedFrom as Date,
            assignedTo: (data.assignedTo as Date | null) ?? null,
            changedById: (data.changedById as string | null) ?? null,
            reason: (data.reason as string | null) ?? null,
            createdAt: new Date('2026-11-10T08:00:00.000Z'),
          };
          assignmentsStore.push(item);
          return item;
        }),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { classId: string; assignedTo: null };
            data: { assignedTo: Date };
          }) => {
            let count = 0;
            for (const a of assignmentsStore) {
              if (a.classId === where.classId && a.assignedTo === null) {
                a.assignedTo = data.assignedTo;
                count += 1;
              }
            }
            return { count };
          },
        ),
      },
      teacherProfile: {
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { userId: string };
            data: { activeClassesCount: number };
          }) => {
            teacherProfileCounts.set(where.userId, data.activeClassesCount);
            return { count: 1 };
          },
        ),
      },
      studentProfile: {
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      systemAuditLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          auditLogs.push(data);
          return data;
        }),
      },
      $transaction: vi.fn(
        async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
          cb(mockPrisma),
      ),
    };

    service = new ClassCrudService(mockPrisma as unknown as PrismaService);
  });

  describe('class-schedule.util', () => {
    it('normalizes scheduleDays in academic weekly order (Mon..Sat then Sun) and rejects invalid days', () => {
      expect(normalizeScheduleDays([0, 5, 1, 3, 1])).toEqual([1, 3, 5, 0]);
      expect(() => normalizeScheduleDays([])).toThrowError(BadRequestException);
      expect(() => normalizeScheduleDays([1, 7])).toThrowError(
        BadRequestException,
      );
      expect(() => normalizeScheduleDays([-1, 2])).toThrowError(
        BadRequestException,
      );
    });

    it('validates HH:mm time range and formats schedule text in Vietnamese', () => {
      expect(assertValidTimeRange('18:00', '19:30')).toEqual({
        startTime: '18:00',
        endTime: '19:30',
      });
      expect(() => assertValidTimeRange('19:30', '18:00')).toThrowError(
        BadRequestException,
      );
      expect(() => assertValidTimeRange('18:00', '18:00')).toThrowError(
        BadRequestException,
      );
      expect(() => assertValidTimeRange('25:00', '26:00')).toThrowError(
        BadRequestException,
      );
      expect(formatScheduleText([1, 3, 5], '18:00', '19:30')).toBe(
        'T2-T4-T6 · 18:00–19:30',
      );
      expect(formatScheduleText([6, 0], '09:00', '11:00')).toBe(
        'T7-CN · 09:00–11:00',
      );
    });

    it('calculates expectedEndDate accurately by counting scheduled weekdays from startDate', () => {
      // 2026-11-02 is Monday (UTC day = 1)
      const start = new Date('2026-11-02T00:00:00.000Z');
      // 6 sessions on Mon-Wed-Fri (1, 3, 5) -> 2 weeks -> Friday 2026-11-13
      const end6 = calculateExpectedEndDate(start, [1, 3, 5], 6);
      expect(end6.toISOString().slice(0, 10)).toBe('2026-11-13');

      // 24 sessions on Mon-Wed-Fri (8 weeks) -> Friday 2026-12-25
      const end24 = calculateExpectedEndDate(start, [1, 3, 5], 24);
      expect(end24.toISOString().slice(0, 10)).toBe('2026-12-25');
    });

    it('detects schedule overlap when sharing at least one weekday and overlapping time interval', () => {
      const base = {
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
      };
      expect(
        hasScheduleOverlap(base, {
          scheduleDays: [3, 6],
          scheduleStartTime: '19:00',
          scheduleEndTime: '20:30',
        }),
      ).toBe(true);
      // Adjacent interval [19:30, 21:00) does not overlap [18:00, 19:30)
      expect(
        hasScheduleOverlap(base, {
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '19:30',
          scheduleEndTime: '21:00',
        }),
      ).toBe(false);
      // Disjoint weekdays (Tue-Thu-Sat)
      expect(
        hasScheduleOverlap(base, {
          scheduleDays: [2, 4, 6],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
        }),
      ).toBe(false);
    });
  });

  describe('createClass', () => {
    it('creates a class, defaults totalSessions from course.defaultSessions, calculates expectedEndDate, creates initial teacher assignment, and syncs teacher counter', async () => {
      const created = await service.createClass(adminActor, {
        code: '  hsk1-k26-01  ',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [5, 1, 3],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        notes: '  Lớp tối T2-4-6  ',
      });

      expect(created.code).toBe('HSK1-K26-01');
      expect(created.totalSessions).toBe(24);
      expect(created.scheduleDays).toEqual([1, 3, 5]);
      expect(created.scheduleText).toBe('T2-T4-T6 · 18:00–19:30');
      expect(created.startDate).toBe('2026-11-02');
      expect(created.expectedEndDate).toBe('2026-12-25');
      expect(created.scheduleConflictWarning).toBeNull();
      expect(assignmentsStore).toHaveLength(1);
      expect(assignmentsStore[0]?.teacherId).toBe('teacher-01');
      expect(assignmentsStore[0]?.assignedTo).toBeNull();
      expect(teacherProfileCounts.get('teacher-01')).toBe(1);
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]?.action).toBe('CLASS_CREATED');
    });

    it('rejects inactive course, inactive/non-teacher user, and duplicate class code', async () => {
      await expect(
        service.createClass(adminActor, {
          code: 'HSK-MISSING-01',
          courseId: 'course-missing',
          teacherId: 'teacher-01',
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          startDate: '2026-11-02',
        }),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy khóa học'));

      await expect(
        service.createClass(adminActor, {
          code: 'HSK-INACTIVE-01',
          courseId: 'course-inactive',
          teacherId: 'teacher-01',
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          startDate: '2026-11-02',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Khóa học đã ngừng sử dụng, không thể mở lớp mới',
        ),
      );

      await expect(
        service.createClass(adminActor, {
          code: 'HSK1-INVALID-TEACHER',
          courseId: 'course-hsk1',
          teacherId: 'teacher-inactive',
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          startDate: '2026-11-02',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Giáo viên phụ trách không hợp lệ hoặc đã ngừng hoạt động',
        ),
      );

      await expect(
        service.createClass(adminActor, {
          code: 'HSK1-STUDENT-01',
          courseId: 'course-hsk1',
          teacherId: 'student-01',
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          startDate: '2026-11-02',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Giáo viên phụ trách không hợp lệ hoặc đã ngừng hoạt động',
        ),
      );

      await service.createClass(adminActor, {
        code: 'HSK1-DUP',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
      });

      await expect(
        service.createClass(adminActor, {
          code: ' hsk1-dup ',
          courseId: 'course-hsk1',
          teacherId: 'teacher-01',
          scheduleDays: [2, 4, 6],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          startDate: '2026-11-02',
        }),
      ).rejects.toThrowError(
        new ConflictException('Mã lớp học đã tồn tại trong hệ thống'),
      );
    });

    it('returns non-blocking scheduleConflictWarning when the assigned teacher has an overlapping UPCOMING or ACTIVE class', async () => {
      await service.createClass(adminActor, {
        code: 'HSK1-K26-01',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
      });

      const overlapping = await service.createClass(adminActor, {
        code: 'HSK2-K26-02',
        courseId: 'course-hsk2',
        teacherId: 'teacher-01',
        scheduleDays: [3, 5],
        scheduleStartTime: '18:30',
        scheduleEndTime: '20:00',
        startDate: '2026-11-04',
      });

      expect(overlapping.scheduleConflictWarning).toContain('HSK1-K26-01');
      expect(teacherProfileCounts.get('teacher-01')).toBe(2);
    });
  });

  describe('updateClass', () => {
    it('blocks editing a COMPLETED or ARCHIVED class and blocks changing courseId when class has enrollments', async () => {
      const created = await service.createClass(adminActor, {
        code: 'HSK1-EDIT-01',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
      });

      enrollmentsStore.push({
        id: 'enr-1',
        classId: created.id,
        studentId: 'student-01',
        status: EnrollmentStatus.ACTIVE,
      });

      await expect(
        service.updateClass(adminActor, created.id, {
          courseId: 'course-hsk2',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Không thể đổi khóa học HSK khi lớp đã có học viên hoặc đang diễn ra',
        ),
      );

      classesStore.get(created.id)!.status = ClassStatus.COMPLETED;
      await expect(
        service.updateClass(adminActor, created.id, {
          notes: 'Cố sửa lớp đã kết thúc',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Lớp học đã kết thúc hoặc lưu trữ (chỉ đọc), không thể chỉnh sửa',
        ),
      );
    });

    it('closes old ClassTeacherAssignment, opens new ClassTeacherAssignment, and syncs activeClassesCount for both teachers when teacherId changes', async () => {
      const created = await service.createClass(adminActor, {
        code: 'HSK1-REASSIGN-01',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
      });
      expect(teacherProfileCounts.get('teacher-01')).toBe(1);
      expect(teacherProfileCounts.get('teacher-02')).toBe(0);

      const updated = await service.updateClass(adminActor, created.id, {
        teacherId: 'teacher-02',
        teacherAssignedFrom: '2026-11-16',
        teacherChangeReason: 'Cô Trương nghỉ thai sản, bàn giao cho thầy Lý',
        status: ClassStatus.ACTIVE,
      });

      expect(updated.teacherId).toBe('teacher-02');
      expect(updated.teacher.fullName).toBe('Lý Giáo Viên');
      expect(updated.status).toBe(ClassStatus.ACTIVE);
      expect(assignmentsStore).toHaveLength(2);
      expect(assignmentsStore[0]?.teacherId).toBe('teacher-01');
      expect(
        assignmentsStore[0]?.assignedTo?.toISOString().slice(0, 10),
      ).toBe('2026-11-16');
      expect(assignmentsStore[1]?.teacherId).toBe('teacher-02');
      expect(
        assignmentsStore[1]?.assignedFrom.toISOString().slice(0, 10),
      ).toBe('2026-11-16');
      expect(assignmentsStore[1]?.assignedTo).toBeNull();
      expect(assignmentsStore[1]?.reason).toBe(
        'Cô Trương nghỉ thai sản, bàn giao cho thầy Lý',
      );
      expect(teacherProfileCounts.get('teacher-01')).toBe(0);
      expect(teacherProfileCounts.get('teacher-02')).toBe(1);
      expect(
        auditLogs.some((l) => l.action === 'CLASS_TEACHER_CHANGED'),
      ).toBe(true);
      expect(auditLogs.some((l) => l.action === 'CLASS_UPDATED')).toBe(true);
    });

    it('syncs StudentProfile.assignedClass when renaming Class.code and rejects teacherAssignedFrom < openAssignment.assignedFrom', async () => {
      const created = await service.createClass(adminActor, {
        code: 'HSK1-RENAME-OLD',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
      });

      const renamed = await service.updateClass(adminActor, created.id, {
        code: 'hsk1-rename-new',
      });
      expect(renamed.code).toBe('HSK1-RENAME-NEW');
      expect(
        (mockPrisma.studentProfile as { updateMany: ReturnType<typeof vi.fn> })
          .updateMany,
      ).toHaveBeenCalledWith({
        where: { currentClassId: created.id },
        data: { assignedClass: 'HSK1-RENAME-NEW' },
      });

      await expect(
        service.updateClass(adminActor, created.id, {
          teacherId: 'teacher-02',
          teacherAssignedFrom: '2026-10-25', // before openAssignment.assignedFrom (2026-11-02)
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Ngày bàn giao giáo viên mới không được nhỏ hơn ngày bắt đầu phân công hiện tại',
        ),
      );
    });

    it('REGRESSION: rejects a future teacherAssignedFrom without changing teacherId, assignments, counters or audit trail', async () => {
      const created = await service.createClass(adminActor, {
        code: 'HSK1-FUTURE-01',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
      });

      await expect(
        service.updateClass(adminActor, created.id, {
          teacherId: 'teacher-02',
          teacherAssignedFrom: '2027-01-15', // today (pinned) = 2026-12-31 GMT+7
        }),
      ).rejects.toThrowError(/ngày tương lai/);

      expect(classesStore.get(created.id)?.teacherId).toBe('teacher-01');
      expect(assignmentsStore).toHaveLength(1);
      expect(assignmentsStore[0]?.teacherId).toBe('teacher-01');
      expect(assignmentsStore[0]?.assignedTo).toBeNull();
      expect(teacherProfileCounts.get('teacher-01')).toBe(1);
      expect(teacherProfileCounts.get('teacher-02')).toBe(0);
      expect(
        auditLogs.some((l) => l.action === 'CLASS_TEACHER_CHANGED'),
      ).toBe(false);
    });

    it('REGRESSION: hands over the class on the effective date when teacherAssignedFrom is today (default) so history and access date agree', async () => {
      const created = await service.createClass(adminActor, {
        code: 'HSK1-TODAY-01',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
      });

      const updated = await service.updateClass(adminActor, created.id, {
        teacherId: 'teacher-02',
      });

      expect(updated.teacherId).toBe('teacher-02');
      expect(assignmentsStore[0]?.assignedTo?.toISOString().slice(0, 10)).toBe(
        '2026-12-31',
      );
      expect(
        assignmentsStore[1]?.assignedFrom.toISOString().slice(0, 10),
      ).toBe('2026-12-31');
    });
  });

  describe('schedule conflict warning considers the real active period of both classes', () => {
    const slice = {
      scheduleDays: [1, 3, 5],
      scheduleStartTime: '18:00',
      scheduleEndTime: '19:30',
    };

    it('does not warn when weekday and time match but the two classes never run in the same period', () => {
      expect(
        hasScheduleOverlap(
          {
            ...slice,
            startDate: new Date('2026-09-01T00:00:00.000Z'),
            endDate: new Date('2026-10-30T00:00:00.000Z'),
          },
          {
            ...slice,
            startDate: new Date('2026-11-02T00:00:00.000Z'),
            endDate: new Date('2026-12-25T00:00:00.000Z'),
          },
        ),
      ).toBe(false);
    });

    it('warns when periods touch on the boundary date (inclusive) or one side is open-ended', () => {
      expect(
        hasScheduleOverlap(
          {
            ...slice,
            startDate: new Date('2026-09-01T00:00:00.000Z'),
            endDate: new Date('2026-11-02T00:00:00.000Z'),
          },
          {
            ...slice,
            startDate: new Date('2026-11-02T00:00:00.000Z'),
            endDate: new Date('2026-12-25T00:00:00.000Z'),
          },
        ),
      ).toBe(true);
      expect(
        hasScheduleOverlap(
          { ...slice, startDate: new Date('2026-09-01T00:00:00.000Z'), endDate: null },
          {
            ...slice,
            startDate: new Date('2027-01-05T00:00:00.000Z'),
            endDate: new Date('2027-02-26T00:00:00.000Z'),
          },
        ),
      ).toBe(true);
    });

    it('createClass: no warning for a later same-slot class after the first one ends, warning once their periods overlap', async () => {
      await service.createClass(adminActor, {
        code: 'HSK1-A',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        totalSessions: 6, // ends Friday 2026-11-13
      });

      const after = await service.createClass(adminActor, {
        code: 'HSK1-B',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-16',
        totalSessions: 6,
      });
      expect(after.scheduleConflictWarning).toBeNull();

      const overlapping = await service.createClass(adminActor, {
        code: 'HSK1-C',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-13',
        totalSessions: 6,
      });
      expect(overlapping.scheduleConflictWarning).toContain('HSK1-A');
    });

    it('REGRESSION (SEC-04): verifies active course inside transaction after acquiring row locks', async () => {
      const order: string[] = [];
      const origQueryRaw = mockPrisma.$queryRaw as ReturnType<typeof vi.fn>;
      const origCourseFind = (mockPrisma.course as { findUnique: ReturnType<typeof vi.fn> }).findUnique;
      origQueryRaw.mockImplementationOnce(async (...args: unknown[]) => {
        order.push('lock_teacher');
        return [{ id: (args[1] as string) ?? 'teacher-01' }];
      });
      origCourseFind.mockImplementationOnce(async (args: { where: { id: string } }) => {
        order.push('check_course');
        return coursesStore.get(args.where.id) ?? null;
      });

      await service.createClass(adminActor, {
        code: 'HSK1-ATOMIC',
        courseId: 'course-hsk1',
        teacherId: 'teacher-01',
        scheduleDays: [2, 4],
        scheduleStartTime: '08:00',
        scheduleEndTime: '09:30',
        startDate: '2026-11-03',
        totalSessions: 6,
      });

      expect(order).toEqual(['lock_teacher', 'check_course']);
    });
  });
});
