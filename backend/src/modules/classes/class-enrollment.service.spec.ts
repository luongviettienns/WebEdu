import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassStatus,
  EnrollmentStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import { ClassEnrollmentService } from './services/class-enrollment.service.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

interface MockStudentUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
  studentProfile: {
    userId: string;
    assignedClass: string | null;
    currentClassId: string | null;
    enrolledAt: Date | null;
  } | null;
}

interface MockClassRecord {
  id: string;
  code: string;
  status: ClassStatus;
}

interface MockEnrollmentRecord {
  id: string;
  classId: string;
  studentId: string;
  status: EnrollmentStatus;
  enrolledDate: Date;
  leftDate: Date | null;
  reason: string | null;
}

describe('ClassEnrollmentService — Student Enrollment, Transfer & Drop Lifecycle', () => {
  let service: ClassEnrollmentService;
  let usersStore: Map<string, MockStudentUser>;
  let classesStore: Map<string, MockClassRecord>;
  let enrollmentsStore: MockEnrollmentRecord[];
  let lockedUserIdsOrder: string[];
  let auditLogs: Array<Record<string, unknown>>;
  let mockPrisma: Record<string, unknown>;

  const adminActor: AuthenticatedUser = {
    id: 'admin-01',
    email: 'admin@webedu.vn',
    fullName: 'Quản Trị Đào Tạo',
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
    usersStore = new Map([
      [
        'student-02',
        {
          id: 'student-02',
          fullName: 'Nguyễn Học Viên B',
          email: 'student02@webedu.vn',
          phone: '0901000002',
          roles: [Role.STUDENT],
          status: UserStatus.PENDING_CLASS,
          studentProfile: {
            userId: 'student-02',
            assignedClass: null,
            currentClassId: null,
            enrolledAt: null,
          },
        },
      ],
      [
        'student-01',
        {
          id: 'student-01',
          fullName: 'Trần Học Viên A',
          email: 'student01@webedu.vn',
          phone: '0901000001',
          roles: [Role.STUDENT],
          status: UserStatus.PENDING_CLASS,
          studentProfile: {
            userId: 'student-01',
            assignedClass: null,
            currentClassId: null,
            enrolledAt: null,
          },
        },
      ],
      [
        'student-inactive',
        {
          id: 'student-inactive',
          fullName: 'Lê Học Viên Khóa',
          email: 'inactive@webedu.vn',
          phone: '0901000003',
          roles: [Role.STUDENT],
          status: UserStatus.INACTIVE,
          studentProfile: {
            userId: 'student-inactive',
            assignedClass: null,
            currentClassId: null,
            enrolledAt: null,
          },
        },
      ],
      [
        'student-sa',
        {
          id: 'student-sa',
          fullName: 'Superadmin Kiêm Học Viên',
          email: 'sa@webedu.vn',
          phone: '0901000099',
          roles: [Role.STUDENT, Role.SUPERADMIN],
          status: UserStatus.PENDING_CLASS,
          studentProfile: {
            userId: 'student-sa',
            assignedClass: null,
            currentClassId: null,
            enrolledAt: null,
          },
        },
      ],
    ]);

    classesStore = new Map([
      [
        'class-hsk1',
        {
          id: 'class-hsk1',
          code: 'HSK1-K26-01',
          status: ClassStatus.ACTIVE,
        },
      ],
      [
        'class-hsk2',
        {
          id: 'class-hsk2',
          code: 'HSK2-K26-01',
          status: ClassStatus.UPCOMING,
        },
      ],
      [
        'class-completed',
        {
          id: 'class-completed',
          code: 'HSK1-OLD-01',
          status: ClassStatus.COMPLETED,
        },
      ],
      [
        'class-archived',
        {
          id: 'class-archived',
          code: 'HSK1-ARC-01',
          status: ClassStatus.ARCHIVED,
        },
      ],
    ]);

    enrollmentsStore = [];
    lockedUserIdsOrder = [];
    auditLogs = [];

    mockPrisma = {
      $queryRaw: vi.fn(
        async (strings: TemplateStringsArray, ...values: string[]) => {
          const lockedId = values[0] ?? '';
          const sql = strings.join('?');
          if (sql.includes('"users"')) {
            lockedUserIdsOrder.push(lockedId);
          }
          return [{ id: lockedId }];
        },
      ),
      class: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return classesStore.get(where.id) ?? null;
        }),
      },
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return usersStore.get(where.id) ?? null;
        }),
        findMany: vi.fn(
          async ({ where }: { where: { id: { in: string[] } } }) => {
            return where.id.in
              .map((id) => usersStore.get(id))
              .filter((u): u is MockStudentUser => Boolean(u));
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
            if (data.status) u.status = data.status;
            return u;
          },
        ),
      },
      studentProfile: {
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { userId: string };
            data: {
              assignedClass: string | null;
              currentClassId: string | null;
              enrolledAt: Date | null;
            };
          }) => {
            const u = usersStore.get(where.userId);
            if (!u || !u.studentProfile) throw new Error('Profile not found');
            u.studentProfile.assignedClass = data.assignedClass;
            u.studentProfile.currentClassId = data.currentClassId;
            u.studentProfile.enrolledAt = data.enrolledAt;
            return u.studentProfile;
          },
        ),
      },
      enrollment: {
        findMany: vi.fn(
          async ({
            where,
          }: {
            where: { studentId: { in: string[] }; status: EnrollmentStatus };
          }) => {
            return enrollmentsStore
              .filter(
                (e) =>
                  where.studentId.in.includes(e.studentId) &&
                  e.status === where.status,
              )
              .map((e) => ({
                ...e,
                class: { code: classesStore.get(e.classId)?.code ?? 'UNKNOWN' },
              }));
          },
        ),
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: {
              classId: string;
              studentId: string;
              status: EnrollmentStatus;
            };
          }) => {
            return (
              enrollmentsStore.find(
                (e) =>
                  e.classId === where.classId &&
                  e.studentId === where.studentId &&
                  e.status === where.status,
              ) ?? null
            );
          },
        ),
        create: vi.fn(
          async ({
            data,
          }: {
            data: {
              classId: string;
              studentId: string;
              status: EnrollmentStatus;
              enrolledDate: Date;
              reason?: string | null;
            };
          }) => {
            const existingActive = enrollmentsStore.find(
              (e) =>
                e.studentId === data.studentId &&
                e.status === EnrollmentStatus.ACTIVE &&
                data.status === EnrollmentStatus.ACTIVE,
            );
            if (existingActive) {
              const err = new Error('Unique constraint failed') as Error & {
                code: string;
              };
              err.code = 'P2002';
              throw err;
            }
            const created: MockEnrollmentRecord = {
              id: `enr-${enrollmentsStore.length + 1}`,
              classId: data.classId,
              studentId: data.studentId,
              status: data.status,
              enrolledDate: data.enrolledDate,
              leftDate: null,
              reason: data.reason ?? null,
            };
            enrollmentsStore.push(created);
            return created;
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: {
              status?: EnrollmentStatus;
              leftDate?: Date | null;
              reason?: string | null;
            };
          }) => {
            const existing = enrollmentsStore.find((e) => e.id === where.id);
            if (!existing) throw new Error('Enrollment not found');
            if (data.status) existing.status = data.status;
            if ('leftDate' in data) existing.leftDate = data.leftDate ?? null;
            if ('reason' in data) existing.reason = data.reason ?? null;
            return existing;
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

    service = new ClassEnrollmentService(
      mockPrisma as unknown as PrismaService,
    );
  });

  describe('enrollStudents', () => {
    it('batch-enrolls multiple PENDING_CLASS students, locks rows in ascending lexical ID order, activates users, updates profiles, and writes audit log', async () => {
      const result = await service.enrollStudents(adminActor, 'class-hsk1', {
        studentIds: [' student-02 ', 'student-01', 'student-02'],
        enrolledDate: '2026-11-02',
      });

      expect(result).toEqual({
        enrolledCount: 2,
        classId: 'class-hsk1',
        classCode: 'HSK1-K26-01',
        studentIds: ['student-01', 'student-02'],
      });
      // Deadlock prevention: student-01 locked before student-02 even though input had student-02 first
      expect(lockedUserIdsOrder).toEqual(['student-01', 'student-02']);

      const st1 = usersStore.get('student-01')!;
      const st2 = usersStore.get('student-02')!;
      expect(st1.status).toBe(UserStatus.ACTIVE);
      expect(st1.studentProfile?.assignedClass).toBe('HSK1-K26-01');
      expect(st1.studentProfile?.currentClassId).toBe('class-hsk1');
      expect(st2.status).toBe(UserStatus.ACTIVE);
      expect(st2.studentProfile?.assignedClass).toBe('HSK1-K26-01');
      expect(st2.studentProfile?.currentClassId).toBe('class-hsk1');

      expect(enrollmentsStore).toHaveLength(2);
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]?.action).toBe('CLASS_STUDENTS_ENROLLED');
    });

    it('rejects enrolling into COMPLETED or ARCHIVED classes or when student is INACTIVE or privileged', async () => {
      await expect(
        service.enrollStudents(adminActor, 'class-missing', {
          studentIds: ['student-01'],
        }),
      ).rejects.toThrowError(new NotFoundException('Không tìm thấy lớp học'));

      await expect(
        service.enrollStudents(adminActor, 'class-completed', {
          studentIds: ['student-01'],
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Chỉ có thể thêm học viên vào lớp Sắp mở (UPCOMING) hoặc Đang học (ACTIVE)',
        ),
      );

      await expect(
        service.enrollStudents(adminActor, 'class-archived', {
          studentIds: ['student-01'],
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Chỉ có thể thêm học viên vào lớp Sắp mở (UPCOMING) hoặc Đang học (ACTIVE)',
        ),
      );

      await expect(
        service.enrollStudents(adminActor, 'class-hsk1', {
          studentIds: ['student-inactive'],
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Học viên Lê Học Viên Khóa đang ở trạng thái Vô hiệu hóa, không thể thêm vào lớp',
        ),
      );

      await expect(
        service.enrollStudents(adminActor, 'class-hsk1', {
          studentIds: ['student-sa'],
        }),
      ).rejects.toThrowError(ForbiddenException);
    });

    it('rejects with 409 ConflictException when any student already has an ACTIVE enrollment or when P2002 occurs concurrently', async () => {
      await service.enrollStudents(adminActor, 'class-hsk1', {
        studentIds: ['student-01'],
        enrolledDate: '2026-11-02',
      });

      await expect(
        service.enrollStudents(adminActor, 'class-hsk2', {
          studentIds: ['student-01', 'student-02'],
          enrolledDate: '2026-11-05',
        }),
      ).rejects.toThrowError(
        new ConflictException(
          'Học viên đã có lớp học đang hoạt động (HSK1-K26-01). Mỗi học viên chỉ được học 1 lớp tại một thời điểm',
        ),
      );

      // Simulate concurrent P2002 bypassing pre-check
      (
        mockPrisma.enrollment as { findMany: ReturnType<typeof vi.fn> }
      ).findMany.mockResolvedValueOnce([]);
      await expect(
        service.enrollStudents(adminActor, 'class-hsk2', {
          studentIds: ['student-01'],
          enrolledDate: '2026-11-05',
        }),
      ).rejects.toThrowError(
        new ConflictException(
          'Học viên đã có lớp học đang hoạt động bởi một yêu cầu đồng thời khác',
        ),
      );
    });

    it('REGRESSION (P1-2 / SEC-03): rejects a future enrolledDate without creating enrollments', async () => {
      await expect(
        service.enrollStudents(adminActor, 'class-hsk1', {
          studentIds: ['student-01'],
          enrolledDate: '2027-01-10', // today (pinned) = 2026-12-31 GMT+7
        }),
      ).rejects.toThrowError(/ngày trong tương lai/);

      expect(enrollmentsStore).toHaveLength(0);
    });
  });

  describe('transferStudent', () => {
    beforeEach(async () => {
      await service.enrollStudents(adminActor, 'class-hsk1', {
        studentIds: ['student-01'],
        enrolledDate: '2026-11-02',
      });
    });

    it('marks old enrollment TRANSFERRED with leftDate FIRST, creates new ACTIVE enrollment in target class, and updates StudentProfile while preserving history', async () => {
      const result = await service.transferStudent(
        adminActor,
        'class-hsk1',
        'student-01',
        {
          targetClassId: 'class-hsk2',
          transferDate: '2026-11-10',
          reason: 'Đổi ca học sang lớp mới',
        },
      );

      expect(result).toEqual({
        status: 'TRANSFERRED',
        sourceClassId: 'class-hsk1',
        targetClassId: 'class-hsk2',
        targetClassCode: 'HSK2-K26-01',
        studentId: 'student-01',
      });

      expect(enrollmentsStore).toHaveLength(2);
      const oldEnr = enrollmentsStore[0]!;
      const newEnr = enrollmentsStore[1]!;

      expect(oldEnr.classId).toBe('class-hsk1');
      expect(oldEnr.status).toBe(EnrollmentStatus.TRANSFERRED);
      expect(oldEnr.leftDate?.toISOString().slice(0, 10)).toBe('2026-11-10');
      expect(oldEnr.reason).toBe('Đổi ca học sang lớp mới');

      expect(newEnr.classId).toBe('class-hsk2');
      expect(newEnr.status).toBe(EnrollmentStatus.ACTIVE);
      expect(newEnr.enrolledDate.toISOString().slice(0, 10)).toBe('2026-11-10');
      expect(newEnr.leftDate).toBeNull();

      const student = usersStore.get('student-01')!;
      expect(student.status).toBe(UserStatus.ACTIVE);
      expect(student.studentProfile?.assignedClass).toBe('HSK2-K26-01');
      expect(student.studentProfile?.currentClassId).toBe('class-hsk2');
      expect(
        auditLogs.some((l) => l.action === 'CLASS_STUDENT_TRANSFERRED'),
      ).toBe(true);
    });

    it('rejects transferring to the same class, transferring to a COMPLETED class, or transferDate < enrolledDate', async () => {
      await expect(
        service.transferStudent(adminActor, 'class-hsk1', 'student-01', {
          targetClassId: 'class-hsk1',
          transferDate: '2026-11-10',
        }),
      ).rejects.toThrowError(
        new BadRequestException('Lớp chuyển đến phải khác lớp hiện tại'),
      );

      await expect(
        service.transferStudent(adminActor, 'class-hsk1', 'student-01', {
          targetClassId: 'class-completed',
          transferDate: '2026-11-10',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Chỉ có thể chuyển học viên sang lớp Sắp mở hoặc Đang học',
        ),
      );

      await expect(
        service.transferStudent(adminActor, 'class-hsk1', 'student-01', {
          targetClassId: 'class-hsk2',
          transferDate: '2026-11-01',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Ngày chuyển lớp không được nhỏ hơn ngày vào lớp ban đầu',
        ),
      );
    });

    it('REGRESSION: rejects a future transferDate and keeps the source enrollment ACTIVE with no target enrollment created', async () => {
      await expect(
        service.transferStudent(adminActor, 'class-hsk1', 'student-01', {
          targetClassId: 'class-hsk2',
          transferDate: '2027-01-10', // today (pinned) = 2026-12-31 GMT+7
        }),
      ).rejects.toThrowError(/ngày trong tương lai/);

      expect(enrollmentsStore).toHaveLength(1);
      expect(enrollmentsStore[0]?.status).toBe(EnrollmentStatus.ACTIVE);
      expect(usersStore.get('student-01')?.studentProfile?.currentClassId).toBe(
        'class-hsk1',
      );
    });

    it('REGRESSION (SEC-01): rejects transferring an INACTIVE student and leaves enrollment untouched', async () => {
      usersStore.get('student-01')!.status = UserStatus.INACTIVE;

      await expect(
        service.transferStudent(adminActor, 'class-hsk1', 'student-01', {
          targetClassId: 'class-hsk2',
          transferDate: '2026-11-10',
        }),
      ).rejects.toThrowError(/Vô hiệu hóa/);

      expect(enrollmentsStore).toHaveLength(1);
      expect(enrollmentsStore[0]?.status).toBe(EnrollmentStatus.ACTIVE);
    });
  });

  describe('dropStudent', () => {
    beforeEach(async () => {
      await service.enrollStudents(adminActor, 'class-hsk1', {
        studentIds: ['student-01'],
        enrolledDate: '2026-11-02',
      });
    });

    it('marks enrollment DROPPED with leftDate and reason, resets User.status to PENDING_CLASS and StudentProfile.currentClassId to null while preserving history', async () => {
      const result = await service.dropStudent(
        adminActor,
        'class-hsk1',
        'student-01',
        {
          leftDate: '2026-11-12',
          reason: 'Bảo lưu chờ khóa sau',
        },
      );

      expect(result).toEqual({
        status: 'DROPPED',
        classId: 'class-hsk1',
        studentId: 'student-01',
      });

      expect(enrollmentsStore).toHaveLength(1);
      expect(enrollmentsStore[0]?.status).toBe(EnrollmentStatus.DROPPED);
      expect(enrollmentsStore[0]?.leftDate?.toISOString().slice(0, 10)).toBe(
        '2026-11-12',
      );
      expect(enrollmentsStore[0]?.reason).toBe('Bảo lưu chờ khóa sau');

      const student = usersStore.get('student-01')!;
      expect(student.status).toBe(UserStatus.PENDING_CLASS);
      expect(student.studentProfile?.assignedClass).toBeNull();
      expect(student.studentProfile?.currentClassId).toBeNull();
      expect(student.studentProfile?.enrolledAt).toBeNull();
      expect(auditLogs.some((l) => l.action === 'CLASS_STUDENT_DROPPED')).toBe(
        true,
      );
    });

    it('preserves User.status = ACTIVE when dropping a dual-role [STUDENT, TEACHER] account so the teacher is not locked out', async () => {
      usersStore.set('student-teacher-dual', {
        id: 'student-teacher-dual',
        fullName: 'Giáo Viên Kiêm Học Viên',
        email: 'dual@webedu.vn',
        phone: '0901000088',
        roles: [Role.STUDENT, Role.TEACHER],
        status: UserStatus.ACTIVE,
        studentProfile: {
          userId: 'student-teacher-dual',
          assignedClass: null,
          currentClassId: null,
          enrolledAt: null,
        },
      });

      await service.enrollStudents(adminActor, 'class-hsk2', {
        studentIds: ['student-teacher-dual'],
        enrolledDate: '2026-11-02',
      });

      await service.dropStudent(
        adminActor,
        'class-hsk2',
        'student-teacher-dual',
        {
          leftDate: '2026-11-12',
          reason: 'Bận lịch dạy, tạm dừng học lớp nội bộ',
        },
      );

      const dualUser = usersStore.get('student-teacher-dual')!;
      expect(dualUser.status).toBe(UserStatus.ACTIVE);
      expect(dualUser.studentProfile?.currentClassId).toBeNull();
      expect(dualUser.studentProfile?.assignedClass).toBeNull();
    });

    it('rejects dropping from a COMPLETED class or when leftDate < enrolledDate', async () => {
      await expect(
        service.dropStudent(adminActor, 'class-hsk1', 'student-01', {
          leftDate: '2026-11-01',
        }),
      ).rejects.toThrowError(
        new BadRequestException('Ngày rời lớp không được nhỏ hơn ngày vào lớp'),
      );

      classesStore.get('class-hsk1')!.status = ClassStatus.COMPLETED;
      await expect(
        service.dropStudent(adminActor, 'class-hsk1', 'student-01', {
          leftDate: '2026-11-15',
        }),
      ).rejects.toThrowError(
        new BadRequestException(
          'Không thể rút học viên khỏi lớp đã kết thúc hoặc lưu trữ',
        ),
      );
    });

    it('REGRESSION: rejects a future leftDate and leaves the enrollment, user status and profile untouched', async () => {
      await expect(
        service.dropStudent(adminActor, 'class-hsk1', 'student-01', {
          leftDate: '2027-01-10', // today (pinned) = 2026-12-31 GMT+7
        }),
      ).rejects.toThrowError(/ngày trong tương lai/);

      expect(enrollmentsStore[0]?.status).toBe(EnrollmentStatus.ACTIVE);
      expect(enrollmentsStore[0]?.leftDate).toBeNull();
      expect(usersStore.get('student-01')?.studentProfile?.currentClassId).toBe(
        'class-hsk1',
      );
      expect(auditLogs.some((l) => l.action === 'CLASS_STUDENT_DROPPED')).toBe(
        false,
      );
    });

    it('accepts leftDate = today (GMT+7) as the boundary of the allowed range', async () => {
      const result = await service.dropStudent(
        adminActor,
        'class-hsk1',
        'student-01',
        { leftDate: '2026-12-31' },
      );
      expect(result.status).toBe('DROPPED');
    });
  });
});
