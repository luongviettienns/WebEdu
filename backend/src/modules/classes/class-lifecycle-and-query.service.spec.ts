import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import { ClassAccessService } from './services/class-access.service.js';
import { ClassQueryService } from './services/class-query.service.js';
import { ClassLifecycleService } from './services/class-lifecycle.service.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

interface MockCourseRecord {
  id: string;
  code: string;
  name: string;
  level: CourseLevel;
  defaultSessions: number | null;
  isActive: boolean;
}

interface MockStudentProfile {
  id: string;
  userId: string;
  currentClassId: string | null;
  assignedClass: string | null;
  enrolledAt: Date | null;
}

interface MockUserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
  studentProfile?: MockStudentProfile | null;
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

interface MockEnrollmentRecord {
  id: string;
  classId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrolledDate: Date;
  leftDate: Date | null;
  reason: string | null;
  createdAt?: Date;
}

interface MockTeacherAssignmentRecord {
  id: string;
  classId: string;
  teacherId: string;
  assignedFrom: Date;
  assignedTo: Date | null;
  changedById: string | null;
  reason: string | null;
  createdAt: Date;
}

describe('ClassAccessService, ClassQueryService & ClassLifecycleService', () => {
  let accessService: ClassAccessService;
  let queryService: ClassQueryService;
  let lifecycleService: ClassLifecycleService;

  let coursesStore: Map<string, MockCourseRecord>;
  let usersStore: Map<string, MockUserRecord>;
  let classesStore: Map<string, MockClassRecord>;
  let enrollmentsStore: MockEnrollmentRecord[];
  let assignmentsStore: MockTeacherAssignmentRecord[];
  let teacherActiveCounts: Map<string, number>;
  let auditLogs: Array<Record<string, unknown>>;
  let lockedUserIdsOrder: string[];
  let mockPrisma: Record<string, unknown>;

  const adminActor: AuthenticatedUser = {
    id: 'admin-01',
    email: 'admin@webedu.vn',
    fullName: 'Quản Trị Đào Tạo',
    phone: '0909000001',
    roles: [Role.ADMIN],
    effectiveRole: Role.ADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const teacherActor1: AuthenticatedUser = {
    id: 'teacher-01',
    email: 'teacher01@webedu.vn',
    fullName: 'Cô Trương',
    phone: '0901111111',
    roles: [Role.TEACHER],
    effectiveRole: Role.TEACHER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const teacherActor2Replaced: AuthenticatedUser = {
    id: 'teacher-02',
    email: 'teacher02@webedu.vn',
    fullName: 'Thầy Lý (Đã Bàn Giao)',
    phone: '0902222222',
    roles: [Role.TEACHER],
    effectiveRole: Role.TEACHER,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const pureSuperadminActor: AuthenticatedUser = {
    id: 'sa-01',
    email: 'sa@webedu.vn',
    fullName: 'Superadmin Thuần',
    phone: '0909999999',
    roles: [Role.SUPERADMIN],
    effectiveRole: Role.SUPERADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const studentActor: AuthenticatedUser = {
    id: 'student-01',
    email: 'student01@webedu.vn',
    fullName: 'Học Viên 1',
    phone: '0903000001',
    roles: [Role.STUDENT],
    effectiveRole: Role.STUDENT,
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
    ]);

    usersStore = new Map([
      [
        'admin-01',
        {
          id: 'admin-01',
          fullName: 'Quản Trị Đào Tạo',
          email: 'admin@webedu.vn',
          phone: '0909000001',
          roles: [Role.ADMIN],
          status: UserStatus.ACTIVE,
        },
      ],
      [
        'teacher-01',
        {
          id: 'teacher-01',
          fullName: 'Cô Trương',
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
          fullName: 'Thầy Lý (Đã Bàn Giao)',
          email: 'teacher02@webedu.vn',
          phone: '0902222222',
          roles: [Role.TEACHER],
          status: UserStatus.ACTIVE,
        },
      ],
      [
        'student-01',
        {
          id: 'student-01',
          fullName: 'Học Viên 1',
          email: 'student01@webedu.vn',
          phone: '0903000001',
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
          studentProfile: {
            id: 'sp-01',
            userId: 'student-01',
            currentClassId: 'class-active-1',
            assignedClass: 'HSK1-K26-01',
            enrolledAt: new Date('2026-10-01T00:00:00.000Z'),
          },
        },
      ],
      [
        'student-02',
        {
          id: 'student-02',
          fullName: 'Học Viên 2 (Đã Chuyển Lớp)',
          email: 'student02@webedu.vn',
          phone: '0903000002',
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
          studentProfile: {
            id: 'sp-02',
            userId: 'student-02',
            currentClassId: 'class-other',
            assignedClass: 'HSK1-K26-02',
            enrolledAt: new Date('2026-10-15T00:00:00.000Z'),
          },
        },
      ],
      [
        'student-03',
        {
          id: 'student-03',
          fullName: 'Học Viên 3 (Đã Nghỉ Học)',
          email: 'student03@webedu.vn',
          phone: '0903000003',
          roles: [Role.STUDENT],
          status: UserStatus.PENDING_CLASS,
          studentProfile: {
            id: 'sp-03',
            userId: 'student-03',
            currentClassId: null,
            assignedClass: null,
            enrolledAt: null,
          },
        },
      ],
      [
        'student-04',
        {
          id: 'student-04',
          fullName: 'Học Viên 4',
          email: 'student04@webedu.vn',
          phone: '0903000004',
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
          studentProfile: {
            id: 'sp-04',
            userId: 'student-04',
            currentClassId: 'class-active-1',
            assignedClass: 'HSK1-K26-01',
            enrolledAt: new Date('2026-10-01T00:00:00.000Z'),
          },
        },
      ],
    ]);

    const now = new Date('2026-11-01T08:00:00.000Z');
    classesStore = new Map([
      [
        'class-active-1',
        {
          id: 'class-active-1',
          code: 'HSK1-K26-01',
          courseId: 'course-hsk1',
          teacherId: 'teacher-01',
          status: ClassStatus.ACTIVE,
          startDate: new Date('2026-10-01T00:00:00.000Z'),
          totalSessions: 24,
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          expectedEndDate: new Date('2026-11-25T00:00:00.000Z'),
          actualEndDate: null,
          closedReason: null,
          closedAt: null,
          notes: 'Lớp đang học của cô Trương',
          createdAt: now,
          updatedAt: now,
        },
      ],
      [
        'class-other',
        {
          id: 'class-other',
          code: 'HSK1-K26-02',
          courseId: 'course-hsk1',
          teacherId: 'teacher-02',
          status: ClassStatus.UPCOMING,
          startDate: new Date('2026-11-15T00:00:00.000Z'),
          totalSessions: 24,
          scheduleDays: [2, 4, 6],
          scheduleStartTime: '19:30',
          scheduleEndTime: '21:00',
          expectedEndDate: new Date('2027-01-09T00:00:00.000Z'),
          actualEndDate: null,
          closedReason: null,
          closedAt: null,
          notes: 'Lớp của thầy Lý',
          createdAt: now,
          updatedAt: now,
        },
      ],
      [
        'class-completed-1',
        {
          id: 'class-completed-1',
          code: 'HSK2-K25-99',
          courseId: 'course-hsk2',
          teacherId: 'teacher-01',
          status: ClassStatus.COMPLETED,
          startDate: new Date('2026-06-01T00:00:00.000Z'),
          totalSessions: 30,
          scheduleDays: [1, 3, 5],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          expectedEndDate: new Date('2026-08-10T00:00:00.000Z'),
          actualEndDate: new Date('2026-08-12T00:00:00.000Z'),
          closedReason: 'Hoàn thành khóa học',
          closedAt: new Date('2026-08-12T10:00:00.000Z'),
          notes: 'Lớp đã kết thúc của cô Trương',
          createdAt: now,
          updatedAt: now,
        },
      ],
    ]);

    enrollmentsStore = [
      {
        id: 'enr-active-1',
        classId: 'class-active-1',
        studentId: 'student-01',
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        leftDate: null,
        reason: null,
      },
      {
        id: 'enr-active-4',
        classId: 'class-active-1',
        studentId: 'student-04',
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        leftDate: null,
        reason: null,
      },
      {
        id: 'enr-transferred-2',
        classId: 'class-active-1',
        studentId: 'student-02',
        status: EnrollmentStatus.TRANSFERRED,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        leftDate: new Date('2026-10-15T00:00:00.000Z'),
        reason: 'Chuyển sang lớp HSK1-K26-02',
      },
      {
        id: 'enr-dropped-3',
        classId: 'class-active-1',
        studentId: 'student-03',
        status: EnrollmentStatus.DROPPED,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        leftDate: new Date('2026-10-20T00:00:00.000Z'),
        reason: 'Tạm nghỉ bảo lưu',
      },
    ];

    assignmentsStore = [
      // teacher-02 used to teach class-active-1 before handing over to teacher-01
      {
        id: 'assign-old',
        classId: 'class-active-1',
        teacherId: 'teacher-02',
        assignedFrom: new Date('2026-10-01T00:00:00.000Z'),
        assignedTo: new Date('2026-10-15T00:00:00.000Z'),
        changedById: 'admin-01',
        reason: 'Phân công đầu khóa',
        createdAt: new Date('2026-10-01T08:00:00.000Z'),
      },
      {
        id: 'assign-current',
        classId: 'class-active-1',
        teacherId: 'teacher-01',
        assignedFrom: new Date('2026-10-15T00:00:00.000Z'),
        assignedTo: null,
        changedById: 'admin-01',
        reason: 'Bàn giao lớp cho cô Trương',
        createdAt: new Date('2026-10-15T08:00:00.000Z'),
      },
    ];

    teacherActiveCounts = new Map([
      ['teacher-01', 1],
      ['teacher-02', 1],
    ]);
    auditLogs = [];
    lockedUserIdsOrder = [];

    const matchesWhere = (
      cls: MockClassRecord,
      where?: Record<string, unknown>,
    ): boolean => {
      if (!where) return true;
      if (
        where.id &&
        typeof where.id === 'object' &&
        'not' in (where.id as Record<string, unknown>) &&
        cls.id === (where.id as { not: string }).not
      ) {
        return false;
      }
      if (typeof where.teacherId === 'string' && cls.teacherId !== where.teacherId) {
        return false;
      }
      if (typeof where.courseId === 'string' && cls.courseId !== where.courseId) {
        return false;
      }
      if (typeof where.status === 'string' && cls.status !== where.status) {
        return false;
      }
      if (
        where.status &&
        typeof where.status === 'object' &&
        'in' in (where.status as Record<string, unknown>)
      ) {
        const allowed = (where.status as { in: ClassStatus[] }).in;
        if (!allowed.includes(cls.status)) return false;
      }
      if (Array.isArray(where.OR)) {
        const course = coursesStore.get(cls.courseId)!;
        const teacher = usersStore.get(cls.teacherId)!;
        const matchedOr = (where.OR as Array<Record<string, unknown>>).some(
          (cond) => {
            if (cond.code && typeof cond.code === 'object') {
              const needle = String(
                (cond.code as { contains: string }).contains,
              ).toLowerCase();
              return cls.code.toLowerCase().includes(needle);
            }
            if (cond.course && typeof cond.course === 'object') {
              const nameCond = (cond.course as { name?: { contains: string } })
                .name;
              if (nameCond) {
                return course.name
                  .toLowerCase()
                  .includes(nameCond.contains.toLowerCase());
              }
            }
            if (cond.teacher && typeof cond.teacher === 'object') {
              const fnCond = (
                cond.teacher as { fullName?: { contains: string } }
              ).fullName;
              if (fnCond) {
                return teacher.fullName
                  .toLowerCase()
                  .includes(fnCond.contains.toLowerCase());
              }
            }
            return false;
          },
        );
        if (!matchedOr) return false;
      }
      return true;
    };

    const buildClassListEntity = (cls: MockClassRecord) => {
      const course = coursesStore.get(cls.courseId)!;
      const teacher = usersStore.get(cls.teacherId)!;
      const allEnr = enrollmentsStore.filter((e) => e.classId === cls.id);
      const activeEnr = allEnr.filter(
        (e) => e.status === EnrollmentStatus.ACTIVE,
      );
      return {
        ...cls,
        course,
        teacher,
        enrollments: activeEnr.map((e) => ({ id: e.id, status: e.status })),
        _count: { enrollments: allEnr.length },
      };
    };

    const buildClassDetailEntity = (cls: MockClassRecord) => {
      const base = buildClassListEntity(cls);
      const allEnr = enrollmentsStore
        .filter((e) => e.classId === cls.id)
        .map((e) => ({
          ...e,
          student: usersStore.get(e.studentId)!,
        }));
      const history = assignmentsStore
        .filter((a) => a.classId === cls.id)
        .sort(
          (a, b) =>
            b.assignedFrom.getTime() - a.assignedFrom.getTime() ||
            b.createdAt.getTime() - a.createdAt.getTime(),
        )
        .map((a) => ({
          ...a,
          teacher: usersStore.get(a.teacherId)!,
          changedBy: a.changedById ? usersStore.get(a.changedById) ?? null : null,
        }));
      return {
        ...base,
        enrollments: allEnr,
        teacherHistory: history,
      };
    };

    mockPrisma = {
      $queryRaw: vi.fn(
        async (strings: TemplateStringsArray, ...values: unknown[]) => {
          const sql = strings.join('?');
          if (sql.includes('"users"') && typeof values[0] === 'string') {
            lockedUserIdsOrder.push(values[0]);
          }
          return [{ id: values[0] }];
        },
      ),
      class: {
        findMany: vi.fn(
          async ({
            where,
            skip,
            take,
          }: {
            where?: Record<string, unknown>;
            skip?: number;
            take?: number;
          } = {}) => {
            const filtered = Array.from(classesStore.values()).filter((c) =>
              matchesWhere(c, where),
            );
            const sliced =
              typeof skip === 'number' && typeof take === 'number'
                ? filtered.slice(skip, skip + take)
                : filtered;
            return sliced.map(buildClassListEntity);
          },
        ),
        count: vi.fn(
          async ({ where }: { where?: Record<string, unknown> } = {}) => {
            return Array.from(classesStore.values()).filter((c) =>
              matchesWhere(c, where),
            ).length;
          },
        ),
        findUnique: vi.fn(
          async ({
            where,
            include,
          }: {
            where: { id: string };
            include?: Record<string, unknown>;
          }) => {
            const cls = classesStore.get(where.id);
            if (!cls) return null;
            if (include && 'teacherHistory' in include) {
              return buildClassDetailEntity(cls);
            }
            if (include && 'teacher' in include) {
              return {
                ...cls,
                teacher: usersStore.get(cls.teacherId)!,
              };
            }
            return { ...cls };
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const cls = classesStore.get(where.id);
            if (!cls) throw new Error('Class not found');
            if ('status' in data && data.status !== undefined) {
              cls.status = data.status as ClassStatus;
            }
            if ('actualEndDate' in data) {
              cls.actualEndDate = (data.actualEndDate as Date | null) ?? null;
            }
            if ('closedReason' in data) {
              cls.closedReason = (data.closedReason as string | null) ?? null;
            }
            if ('closedAt' in data) {
              cls.closedAt = (data.closedAt as Date | null) ?? null;
            }
            return cls;
          },
        ),
      },
      enrollment: {
        findMany: vi.fn(
          async ({
            where,
          }: {
            where: { classId: string; status: EnrollmentStatus };
          }) => {
            return enrollmentsStore
              .filter(
                (e) =>
                  e.classId === where.classId && e.status === where.status,
              )
              .map((e) => ({ ...e }));
          },
        ),
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: {
              studentId: string;
              status?: EnrollmentStatus;
              classId?: { not?: string };
              enrolledDate?: { gte?: Date };
              OR?: Array<{
                createdAt?: { gt?: Date };
                enrolledDate?: { gt?: Date };
              }>;
            };
          }) => {
            return (
              enrollmentsStore.find((e) => {
                if (e.studentId !== where.studentId) return false;
                if (where.status && e.status !== where.status) return false;
                if (where.classId?.not && e.classId === where.classId.not) {
                  return false;
                }
                if (
                  where.enrolledDate?.gte &&
                  e.enrolledDate.getTime() < where.enrolledDate.gte.getTime()
                ) {
                  return false;
                }
                if (Array.isArray(where.OR)) {
                  const createdAtMs = e.createdAt?.getTime() ?? 0;
                  const enrolledMs = e.enrolledDate.getTime();
                  const matchedOr = where.OR.some((cond) => {
                    if (cond.createdAt?.gt && createdAtMs > cond.createdAt.gt.getTime()) {
                      return true;
                    }
                    if (
                      cond.enrolledDate?.gt &&
                      enrolledMs > cond.enrolledDate.gt.getTime()
                    ) {
                      return true;
                    }
                    return false;
                  });
                  if (!matchedOr) return false;
                }
                return true;
              }) ?? null
            );
          },
        ),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { classId: string; status: EnrollmentStatus };
            data: { status: EnrollmentStatus; leftDate: Date | null };
          }) => {
            let count = 0;
            for (const e of enrollmentsStore) {
              if (e.classId === where.classId && e.status === where.status) {
                e.status = data.status;
                e.leftDate = data.leftDate;
                count += 1;
              }
            }
            return { count };
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { status?: EnrollmentStatus; leftDate?: Date | null };
          }) => {
            const enr = enrollmentsStore.find((e) => e.id === where.id);
            if (!enr) throw new Error('Enrollment not found');
            if (data.status !== undefined) enr.status = data.status;
            if ('leftDate' in data) enr.leftDate = data.leftDate ?? null;
            return enr;
          },
        ),
      },
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return usersStore.get(where.id) ?? null;
        }),
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; status?: UserStatus };
            data: { status: UserStatus };
          }) => {
            const u = usersStore.get(where.id);
            if (!u) return { count: 0 };
            if (where.status && u.status !== where.status) return { count: 0 };
            u.status = data.status;
            return { count: 1 };
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { status?: UserStatus };
          }) => {
            const u = usersStore.get(where.id);
            if (!u) throw new Error('User not found');
            if (data.status !== undefined) u.status = data.status;
            return u;
          },
        ),
      },
      studentProfile: {
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { userId: string };
            data: {
              currentClassId: string | null;
              assignedClass: string | null;
              enrolledAt: Date | null;
            };
          }) => {
            const u = usersStore.get(where.userId);
            if (!u?.studentProfile) return { count: 0 };
            u.studentProfile.currentClassId = data.currentClassId;
            u.studentProfile.assignedClass = data.assignedClass;
            u.studentProfile.enrolledAt = data.enrolledAt;
            return { count: 1 };
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { userId: string };
            data: {
              currentClassId: string | null;
              assignedClass: string | null;
              enrolledAt: Date | null;
            };
          }) => {
            const u = usersStore.get(where.userId);
            if (!u?.studentProfile) throw new Error('StudentProfile not found');
            u.studentProfile.currentClassId = data.currentClassId;
            u.studentProfile.assignedClass = data.assignedClass;
            u.studentProfile.enrolledAt = data.enrolledAt;
            return u.studentProfile;
          },
        ),
      },
      classTeacherAssignment: {
        updateMany: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { classId: string; assignedTo: Date | null };
            data: { assignedTo: Date | null };
          }) => {
            let count = 0;
            for (const a of assignmentsStore) {
              if (
                a.classId === where.classId &&
                (where.assignedTo === null ? a.assignedTo === null : true)
              ) {
                a.assignedTo = data.assignedTo;
                count += 1;
              }
            }
            return { count };
          },
        ),
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: {
              classId: string;
              teacherId?: string;
              assignedTo?: Date | null;
            };
          }) => {
            const candidates = assignmentsStore.filter(
              (a) =>
                a.classId === where.classId &&
                (where.teacherId ? a.teacherId === where.teacherId : true) &&
                (where.assignedTo === null ? a.assignedTo === null : true),
            );
            return candidates[candidates.length - 1] ?? null;
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: { assignedTo: Date | null };
          }) => {
            const found = assignmentsStore.find((a) => a.id === where.id);
            if (!found) throw new Error('Assignment not found');
            found.assignedTo = data.assignedTo;
            return found;
          },
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const rec: MockTeacherAssignmentRecord = {
            id: `assign-${assignmentsStore.length + 1}`,
            classId: data.classId as string,
            teacherId: data.teacherId as string,
            assignedFrom: data.assignedFrom as Date,
            assignedTo: (data.assignedTo as Date | null) ?? null,
            changedById: (data.changedById as string | null) ?? null,
            reason: (data.reason as string | null) ?? null,
            createdAt: new Date(),
          };
          assignmentsStore.push(rec);
          return rec;
        }),
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
            teacherActiveCounts.set(where.userId, data.activeClassesCount);
            return { count: 1 };
          },
        ),
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

    accessService = new ClassAccessService();
    queryService = new ClassQueryService(
      mockPrisma as unknown as PrismaService,
      accessService,
    );
    lifecycleService = new ClassLifecycleService(
      mockPrisma as unknown as PrismaService,
      queryService,
    );
  });

  describe('ClassAccessService & ClassQueryService', () => {
    it('enforces role-based visibility on listClasses: Admin sees all open classes by default; Teacher only sees own classes; pure SUPERADMIN & STUDENT get 403', async () => {
      await expect(
        queryService.listClasses(pureSuperadminActor, {}),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền truy cập danh sách lớp học'),
      );

      await expect(
        queryService.listClasses(studentActor, {}),
      ).rejects.toThrowError(
        new ForbiddenException('Bạn không có quyền truy cập danh sách lớp học'),
      );

      // Admin default (includeEnded omitted): returns UPCOMING + ACTIVE (2 classes), hides COMPLETED
      const adminDefault = await queryService.listClasses(adminActor, {});
      expect(adminDefault.total).toBe(2);
      expect(adminDefault.items.map((c) => c.code)).toEqual(
        expect.arrayContaining(['HSK1-K26-01', 'HSK1-K26-02']),
      );

      // Admin with includeEnded=true: returns all 3 classes
      const adminAll = await queryService.listClasses(adminActor, {
        includeEnded: 'true',
      });
      expect(adminAll.total).toBe(3);

      // Teacher 1 attempting to pass teacherId=teacher-02 is still restricted to teacher-01
      const teacherList = await queryService.listClasses(teacherActor1, {
        teacherId: 'teacher-02',
      });
      expect(teacherList.total).toBe(1);
      expect(teacherList.items[0]?.code).toBe('HSK1-K26-01');
    });

    it('enforces replaced-teacher isolation and READ_ONLY mode on getClassById, and filters inactive enrollments unless requested', async () => {
      // Teacher 2 was replaced on class-active-1 (exists in teacherHistory) -> MUST be 403 Forbidden!
      await expect(
        queryService.getClassById(teacherActor2Replaced, 'class-active-1'),
      ).rejects.toThrowError(
        new ForbiddenException(
          'Bạn không có quyền truy cập lớp học này (chỉ giáo viên đang phụ trách chính thức của lớp mới được xem)',
        ),
      );

      // Teacher 1 (current teacher) on ACTIVE class -> FULL mode, default enrollments only ACTIVE (2 students)
      const activeDetailDefault = await queryService.getClassById(
        teacherActor1,
        'class-active-1',
      );
      expect(activeDetailDefault.accessMode).toBe('FULL');
      expect(activeDetailDefault.enrollments).toHaveLength(2);
      expect(
        activeDetailDefault.enrollments.every(
          (e) => e.status === EnrollmentStatus.ACTIVE,
        ),
      ).toBe(true);
      expect(activeDetailDefault.teacherHistory).toHaveLength(2);

      // With includeInactiveEnrollments=true -> returns all 4 enrollments (ACTIVE, TRANSFERRED, DROPPED)
      const activeDetailAll = await queryService.getClassById(
        adminActor,
        'class-active-1',
        { includeInactiveEnrollments: 'true' },
      );
      expect(activeDetailAll.enrollments).toHaveLength(4);

      // Teacher 1 on COMPLETED class -> READ_ONLY mode
      const completedDetail = await queryService.getClassById(
        teacherActor1,
        'class-completed-1',
      );
      expect(completedDetail.accessMode).toBe('READ_ONLY');

      // Non-existent class -> 404 NotFoundException
      await expect(
        queryService.getClassById(adminActor, 'class-missing'),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy lớp học'));
    });

    it('REGRESSION (P2-5 & P2-4): excludes source class via excludeClassId in listClasses and returns live scheduleConflictWarning for open overlapping classes', async () => {
      const excluded = await queryService.listClasses(adminActor, {
        excludeClassId: 'class-active-1',
      });
      expect(excluded.total).toBe(1);
      expect(excluded.items.map((c) => c.id)).toEqual(['class-other']);

      // Make class-other share teacher-01 and overlap schedule with class-active-1
      classesStore.get('class-other')!.teacherId = 'teacher-01';
      classesStore.get('class-other')!.scheduleDays = [1, 3, 5];
      classesStore.get('class-other')!.scheduleStartTime = '18:30';
      classesStore.get('class-other')!.scheduleEndTime = '20:00';
      classesStore.get('class-other')!.startDate = new Date('2026-10-15T00:00:00.000Z');
      classesStore.get('class-other')!.expectedEndDate = new Date('2026-12-20T00:00:00.000Z');

      const openDetail = await queryService.getClassById(adminActor, 'class-active-1');
      expect(openDetail.scheduleConflictWarning).toContain('HSK1-K26-02');

      const endedDetail = await queryService.getClassById(adminActor, 'class-completed-1');
      expect(endedDetail.scheduleConflictWarning).toBeNull();
    });
  });

  describe('ClassLifecycleService — completeClass & reopenClass (7-Day Window)', () => {
    it('completes an ACTIVE class, transitions ONLY ACTIVE enrollments to COMPLETED (preserving TRANSFERRED & DROPPED), releases students to PENDING_CLASS, and syncs teacher counter', async () => {
      const completed = await lifecycleService.completeClass(
        adminActor,
        'class-active-1',
        {
          actualEndDate: '2026-11-28',
          reason: 'Kết thúc khóa học HSK1 đúng tiến độ',
        },
      );

      expect(completed.status).toBe(ClassStatus.COMPLETED);
      expect(completed.accessMode).toBe('READ_ONLY');
      expect(completed.actualEndDate).toBe('2026-11-28');
      expect(completed.closedReason).toBe('Kết thúc khóa học HSK1 đúng tiến độ');
      expect(completed.closedAt).toBeTruthy();

      // Locks teacher & active students together in ascending userId order to avoid counter races
      expect(lockedUserIdsOrder).toEqual(['student-01', 'student-04', 'teacher-01']);

      // Only previously ACTIVE enrollments become COMPLETED; TRANSFERRED and DROPPED are untouched!
      const enr1 = enrollmentsStore.find((e) => e.id === 'enr-active-1')!;
      const enr4 = enrollmentsStore.find((e) => e.id === 'enr-active-4')!;
      const enrTransferred = enrollmentsStore.find(
        (e) => e.id === 'enr-transferred-2',
      )!;
      const enrDropped = enrollmentsStore.find(
        (e) => e.id === 'enr-dropped-3',
      )!;

      expect(enr1.status).toBe(EnrollmentStatus.COMPLETED);
      expect(enr1.leftDate?.toISOString().slice(0, 10)).toBe('2026-11-28');
      expect(enr4.status).toBe(EnrollmentStatus.COMPLETED);
      expect(enrTransferred.status).toBe(EnrollmentStatus.TRANSFERRED);
      expect(enrTransferred.leftDate?.toISOString().slice(0, 10)).toBe(
        '2026-10-15',
      );
      expect(enrDropped.status).toBe(EnrollmentStatus.DROPPED);
      expect(enrDropped.leftDate?.toISOString().slice(0, 10)).toBe(
        '2026-10-20',
      );

      // Completed students have their currentClassId cleared and status set to PENDING_CLASS for next HSK level
      const s1 = usersStore.get('student-01')!;
      expect(s1.status).toBe(UserStatus.PENDING_CLASS);
      expect(s1.studentProfile?.currentClassId).toBeNull();
      expect(s1.studentProfile?.assignedClass).toBeNull();

      // Teacher activeClassesCount synced down to 0
      expect(teacherActiveCounts.get('teacher-01')).toBe(0);
      expect(
        auditLogs.some((l) => l.action === 'CLASS_COMPLETED'),
      ).toBe(true);
    });

    it('REGRESSION: rejects a future actualEndDate and leaves class, enrollments and teacher assignment untouched', async () => {
      await expect(
        lifecycleService.completeClass(adminActor, 'class-active-1', {
          actualEndDate: '2027-01-10', // today (pinned) = 2026-12-31 GMT+7
        }),
      ).rejects.toThrowError(/ngày trong tương lai/);

      expect(classesStore.get('class-active-1')!.status).toBe(
        ClassStatus.ACTIVE,
      );
      expect(
        enrollmentsStore.find((e) => e.id === 'enr-active-1')!.status,
      ).toBe(EnrollmentStatus.ACTIVE);
      expect(auditLogs.some((l) => l.action === 'CLASS_COMPLETED')).toBe(false);
    });

    it('rejects completeClass when actualEndDate < startDate or class is already COMPLETED', async () => {
      await expect(
        lifecycleService.completeClass(adminActor, 'class-active-1', {
          actualEndDate: '2026-09-15', // before startDate 2026-10-01
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Ngày kết thúc thực tế không được nhỏ hơn ngày khai giảng',
        ),
      );

      await expect(
        lifecycleService.completeClass(adminActor, 'class-completed-1', {
          actualEndDate: '2026-08-20',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Lớp học đã ở trạng thái kết thúc hoặc lưu trữ',
        ),
      );
    });

    it('reopens a COMPLETED class within 7 days, safely skips restoring students who already enrolled in a new ACTIVE class, and blocks reopen after 7 days or when teacher is INACTIVE', async () => {
      // First complete class-active-1
      await lifecycleService.completeClass(adminActor, 'class-active-1', {
        actualEndDate: '2026-11-28',
      });
      const closedAt = classesStore.get('class-active-1')!.closedAt!;

      // Suppose student-04 has already enrolled in a new HSK2 class while student-01 is still waiting
      enrollmentsStore.push({
        id: 'enr-next-hsk2',
        classId: 'class-other',
        studentId: 'student-04',
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-11-29T00:00:00.000Z'),
        leftDate: null,
        reason: null,
      });
      usersStore.get('student-04')!.status = UserStatus.ACTIVE;
      usersStore.get('student-04')!.studentProfile!.currentClassId =
        'class-other';
      usersStore.get('student-04')!.studentProfile!.assignedClass =
        'HSK1-K26-02';

      // Attempt reopen after 8 days -> blocked!
      const eightDaysLater = new Date(
        closedAt.getTime() + 8 * 24 * 60 * 60 * 1000,
      );
      await expect(
        lifecycleService.reopenClass(
          adminActor,
          'class-active-1',
          { reason: 'Thử mở lại quá hạn' },
          eightDaysLater,
        ),
      ).rejects.toThrowError(
        new BadRequestException(
          'Đã quá thời hạn 7 ngày kể từ khi kết thúc lớp, không thể mở lại lớp học',
        ),
      );

      // Attempt reopen when teacher is INACTIVE -> blocked!
      usersStore.get('teacher-01')!.status = UserStatus.INACTIVE;
      const twoDaysLater = new Date(
        closedAt.getTime() + 2 * 24 * 60 * 60 * 1000,
      );
      await expect(
        lifecycleService.reopenClass(
          adminActor,
          'class-active-1',
          { reason: 'Mở lại khi GV đã khóa' },
          twoDaysLater,
        ),
      ).rejects.toThrowError(
        new BadRequestException(
          'Giáo viên phụ trách lớp hiện đã ngừng hoạt động, không thể mở lại lớp học',
        ),
      );

      // Restore teacher to ACTIVE and reopen within 2 days -> succeeds!
      usersStore.get('teacher-01')!.status = UserStatus.ACTIVE;
      const reopened = await lifecycleService.reopenClass(
        adminActor,
        'class-active-1',
        { reason: 'Đóng nhầm lớp, mở lại để nhập nốt điểm danh' },
        twoDaysLater,
      );

      expect(reopened.status).toBe(ClassStatus.ACTIVE);
      expect(reopened.accessMode).toBe('FULL');
      expect(reopened.actualEndDate).toBeNull();
      expect(reopened.closedAt).toBeNull();
      expect(reopened.closedReason).toBeNull();
      // REGRESSION: the response reports exactly how many students were truly restored vs skipped
      expect(reopened.reopenSummary).toEqual({
        restoredStudentsCount: 1,
        skippedStudentsCount: 1,
      });

      // student-01 (no other active class) is restored to ACTIVE in class-active-1
      const enr1 = enrollmentsStore.find((e) => e.id === 'enr-active-1')!;
      expect(enr1.status).toBe(EnrollmentStatus.ACTIVE);
      expect(enr1.leftDate).toBeNull();
      expect(usersStore.get('student-01')?.status).toBe(UserStatus.ACTIVE);
      expect(
        usersStore.get('student-01')?.studentProfile?.currentClassId,
      ).toBe('class-active-1');

      // student-04 (already enrolled in class-other) stays COMPLETED in class-active-1 and ACTIVE in class-other!
      const enr4 = enrollmentsStore.find((e) => e.id === 'enr-active-4')!;
      expect(enr4.status).toBe(EnrollmentStatus.COMPLETED);
      expect(
        usersStore.get('student-04')?.studentProfile?.currentClassId,
      ).toBe('class-other');

      expect(teacherActiveCounts.get('teacher-01')).toBe(1);
      expect(auditLogs.some((l) => l.action === 'CLASS_REOPENED')).toBe(true);
    });

    it('keeps dual-role [STUDENT, TEACHER] user status ACTIVE on completeClass and does NOT pull back a student who enrolled into and then dropped a newer class on reopenClass', async () => {
      // Make student-01 a dual-role [STUDENT, TEACHER] user
      usersStore.get('student-01')!.roles = [Role.STUDENT, Role.TEACHER];

      await lifecycleService.completeClass(adminActor, 'class-active-1', {
        actualEndDate: '2026-11-28',
      });

      // Dual-role student-01 keeps User.status = ACTIVE while StudentProfile is cleared
      expect(usersStore.get('student-01')?.status).toBe(UserStatus.ACTIVE);
      expect(usersStore.get('student-01')?.studentProfile?.currentClassId).toBeNull();
      expect(usersStore.get('student-04')?.status).toBe(UserStatus.PENDING_CLASS);

      // Suppose student-04 enrolled in a newer class on 2026-11-29 and then DROPPED it on 2026-11-30
      enrollmentsStore.push({
        id: 'enr-newer-dropped',
        classId: 'class-other',
        studentId: 'student-04',
        status: EnrollmentStatus.DROPPED,
        enrolledDate: new Date('2026-11-29T00:00:00.000Z'),
        leftDate: new Date('2026-11-30T00:00:00.000Z'),
        reason: 'Bảo lưu ở lớp mới',
      });

      const closedAt = classesStore.get('class-active-1')!.closedAt!;
      const twoDaysLater = new Date(
        closedAt.getTime() + 2 * 24 * 60 * 60 * 1000,
      );

      await lifecycleService.reopenClass(
        adminActor,
        'class-active-1',
        { reason: 'Mở lại lớp kiểm tra bảo vệ lịch sử học viên đã học lớp mới' },
        twoDaysLater,
      );

      // student-04 had a newer enrollment in another class (even though DROPPED) -> must NOT be pulled back to ACTIVE in class-active-1
      const enr4 = enrollmentsStore.find((e) => e.id === 'enr-active-4')!;
      expect(enr4.status).toBe(EnrollmentStatus.COMPLETED);
      expect(usersStore.get('student-04')?.status).toBe(UserStatus.PENDING_CLASS);
      expect(usersStore.get('student-04')?.studentProfile?.currentClassId).toBeNull();
    });

    it('REGRESSION (P2-3): restores same-day prior-class transfers created before closedAt and blocks post-close enrollments even with backdated enrolledDate', async () => {
      // Prior enrollment in class-other before closing on 2026-11-28 (same calendar day!)
      enrollmentsStore.push({
        id: 'enr-prior-same-day',
        classId: 'class-other',
        studentId: 'student-01',
        status: EnrollmentStatus.TRANSFERRED,
        enrolledDate: new Date('2026-11-28T00:00:00.000Z'),
        leftDate: new Date('2026-11-28T00:00:00.000Z'),
        reason: 'Chuyển lớp trước khi đóng lớp',
        createdAt: new Date('2026-11-27T08:00:00.000Z'),
      });

      await lifecycleService.completeClass(adminActor, 'class-active-1', {
        actualEndDate: '2026-11-28',
      });

      const closedAt = classesStore.get('class-active-1')!.closedAt!;

      // student-04 enrolled in another class AFTER closedAt even with backdated enrolledDate < actualEndDate
      enrollmentsStore.push({
        id: 'enr-post-close-backdated',
        classId: 'class-other',
        studentId: 'student-04',
        status: EnrollmentStatus.DROPPED,
        enrolledDate: new Date('2026-11-27T00:00:00.000Z'),
        leftDate: new Date('2026-11-28T00:00:00.000Z'),
        reason: 'Nhập lại sau khi đóng lớp',
        createdAt: new Date(closedAt.getTime() + 60_000),
      });

      const twoDaysLater = new Date(closedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
      const reopened = await lifecycleService.reopenClass(
        adminActor,
        'class-active-1',
        { reason: 'Kiểm tra P2-3' },
        twoDaysLater,
      );

      expect(reopened.reopenSummary).toEqual({
        restoredStudentsCount: 1,
        skippedStudentsCount: 1,
      });
      expect(enrollmentsStore.find((e) => e.id === 'enr-active-1')?.status).toBe(
        EnrollmentStatus.ACTIVE,
      );
      expect(enrollmentsStore.find((e) => e.id === 'enr-active-4')?.status).toBe(
        EnrollmentStatus.COMPLETED,
      );
    });
  });
});

describe('ClassAccessService.resolveCapabilities — server-side capability contract', () => {
  const access = new ClassAccessService();
  const actor = (roles: Role[]): AuthenticatedUser => ({
    id: 'u-1',
    email: 'u1@webedu.vn',
    fullName: 'U1',
    phone: '0909000099',
    roles,
    effectiveRole: roles[0]!,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  });
  const open = { status: ClassStatus.ACTIVE, closedAt: null };
  const closedAt = new Date('2026-12-20T03:00:00.000Z');
  const ended = { status: ClassStatus.COMPLETED, closedAt };
  const DAY = 24 * 60 * 60 * 1000;

  it('gives write capabilities only to ADMIN (including dual ADMIN+TEACHER) and never to a teacher-only viewer', () => {
    const none = {
      canEditClass: false,
      canManageEnrollments: false,
      canComplete: false,
      canReopen: false,
    };
    expect(access.resolveCapabilities(actor([Role.TEACHER]), open)).toEqual(none);
    expect(access.resolveCapabilities(actor([Role.SUPERADMIN]), open)).toEqual(none);
    expect(access.resolveCapabilities(actor([Role.ADMIN]), open)).toEqual({
      canEditClass: true,
      canManageEnrollments: true,
      canComplete: true,
      canReopen: false,
    });
    expect(
      access.resolveCapabilities(actor([Role.ADMIN, Role.TEACHER]), open),
    ).toEqual(access.resolveCapabilities(actor([Role.ADMIN]), open));
    expect(access.resolveEffectiveRole(actor([Role.ADMIN, Role.TEACHER]))).toBe('ADMIN');
    expect(access.resolveEffectiveRole(actor([Role.TEACHER]))).toBe('TEACHER');
  });

  it('exposes canReopen only for an ADMIN within 7 days of closing, and removes write actions on ended classes', () => {
    const admin = actor([Role.ADMIN]);
    const within = access.resolveCapabilities(admin, ended, new Date(closedAt.getTime() + 6 * DAY));
    expect(within).toEqual({
      canEditClass: false,
      canManageEnrollments: false,
      canComplete: false,
      canReopen: true,
    });
    expect(
      access.resolveCapabilities(admin, ended, new Date(closedAt.getTime() + 8 * DAY)).canReopen,
    ).toBe(false);
    expect(
      access.resolveCapabilities(actor([Role.TEACHER]), ended, new Date(closedAt.getTime() + DAY)).canReopen,
    ).toBe(false);
  });
});
