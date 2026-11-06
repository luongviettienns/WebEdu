import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { StudentsService } from './students.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

describe('StudentsService (Slice 2.4 - FUNC-007, 008, 010)', () => {
  let service: StudentsService;

  interface MockStudentUser {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    roles: Role[];
    status: UserStatus;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
    studentProfile: {
      id: string;
      userId: string;
      dateOfBirth: Date;
      guardianEmail: string | null;
      assignedClass: string | null;
      internalNotes: string | null;
      enrolledAt: Date | null;
      consent: {
        id: string;
        guardianEmail: string;
        consentedAt: Date;
        consentVersion: string;
      } | null;
    } | null;
  }

  let usersStore: Map<string, MockStudentUser>;
  let mockPrisma: Record<string, unknown>;

  const adminActor: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@webedu.vn',
    fullName: 'Admin One',
    phone: '0900000001',
    roles: [Role.ADMIN],
    effectiveRole: Role.ADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const studentActorA: AuthenticatedUser = {
    id: 'student-a',
    email: 'a@example.com',
    fullName: 'Student A',
    phone: '0901111111',
    roles: [Role.STUDENT],
    effectiveRole: Role.STUDENT,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  beforeEach(() => {
    usersStore = new Map();

    // Student A (aged 14, has GuardianConsent)
    usersStore.set('student-a', {
      id: 'student-a',
      email: 'a@example.com',
      phone: '0901111111',
      fullName: 'Student A',
      roles: [Role.STUDENT],
      status: UserStatus.PENDING_CLASS,
      tokenVersion: 0,
      createdAt: new Date('2026-06-01T08:00:00.000Z'),
      updatedAt: new Date('2026-06-01T08:00:00.000Z'),
      studentProfile: {
        id: 'sp-a',
        userId: 'student-a',
        dateOfBirth: new Date('2012-03-10T00:00:00.000Z'),
        guardianEmail: 'parent.a@example.com',
        assignedClass: null,
        internalNotes: 'Ghi chú A',
        enrolledAt: null,
        consent: {
          id: 'gc-a',
          guardianEmail: 'parent.a@example.com',
          consentedAt: new Date('2026-06-01T08:00:00.000Z'),
          consentVersion: 'v1.0',
        },
      },
    });

    // Student B (aged 18 at registration in 2026, NO GuardianConsent)
    usersStore.set('student-b', {
      id: 'student-b',
      email: 'b@example.com',
      phone: '0902222222',
      fullName: 'Student B',
      roles: [Role.STUDENT],
      status: UserStatus.PENDING_CLASS,
      tokenVersion: 0,
      createdAt: new Date('2026-06-02T09:00:00.000Z'),
      updatedAt: new Date('2026-06-02T09:00:00.000Z'),
      studentProfile: {
        id: 'sp-b',
        userId: 'student-b',
        dateOfBirth: new Date('2008-01-15T00:00:00.000Z'),
        guardianEmail: null,
        assignedClass: null,
        internalNotes: null,
        enrolledAt: null,
        consent: null,
      },
    });

    mockPrisma = {
      $queryRaw: vi.fn(async () => {
        return Array.from(usersStore.values())
          .filter((u) => u.roles.includes(Role.SUPERADMIN) && u.status === UserStatus.ACTIVE)
          .map((u) => ({ id: u.id }));
      }),
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return usersStore.get(where.id) ?? null;
        }),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => {
          return Array.from(usersStore.values());
        }),
        count: vi.fn(async () => usersStore.size),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const u = usersStore.get(where.id)!;
            if (typeof data.fullName === 'string') u.fullName = data.fullName;
            if (typeof data.phone === 'string') u.phone = data.phone;
            if (typeof data.email === 'string') u.email = data.email;
            if (typeof data.status === 'string') u.status = data.status as UserStatus;
            if (
              data.tokenVersion &&
              typeof data.tokenVersion === 'object' &&
              'increment' in data.tokenVersion
            ) {
              u.tokenVersion += Number(
                (data.tokenVersion as { increment: number }).increment,
              );
            }
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
            data: Record<string, unknown>;
          }) => {
            const u = usersStore.get(where.userId)!;
            if (data.dateOfBirth instanceof Date) {
              u.studentProfile!.dateOfBirth = data.dateOfBirth;
            }
            if (typeof data.assignedClass === 'string') {
              u.studentProfile!.assignedClass = data.assignedClass;
            }
            if (data.enrolledAt instanceof Date) {
              u.studentProfile!.enrolledAt = data.enrolledAt;
            }
            if ('internalNotes' in data) {
              u.studentProfile!.internalNotes = (data.internalNotes as string | null) ?? null;
            }
            return u.studentProfile;
          },
        ),
      },
      systemAuditLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      },
      $transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    };

    service = new StudentsService(mockPrisma as unknown as PrismaService);
  });

  it('enforces IDOR protection: Student A cannot view Student B profile or learning records (FUNC-010)', async () => {
    await expect(service.getStudentById(studentActorA, 'student-b')).rejects.toThrowError(
      new ForbiddenException('Bạn không có quyền truy cập hồ sơ của học viên khác'),
    );

    await expect(
      service.getStudentLearningRecords(studentActorA, 'student-b'),
    ).rejects.toThrowError(new ForbiddenException('Bạn không có quyền truy cập'));
  });

  it('enforces positive multi-role RBAC on getStudentById, internalNotes, and getStudentLearningRecords (P0-1 / SEC-F02 / SEC-F03)', async () => {
    const dualTeacherStudent: AuthenticatedUser = {
      id: 'student-a',
      email: 'a@example.com',
      fullName: 'Dual Teacher Student A',
      phone: '0901111111',
      roles: [Role.TEACHER, Role.STUDENT],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const dualSaStudent: AuthenticatedUser = {
      id: 'student-a',
      email: 'a@example.com',
      fullName: 'Dual SA Student A',
      phone: '0901111111',
      roles: [Role.SUPERADMIN, Role.STUDENT],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const pureSuperadmin: AuthenticatedUser = {
      id: 'sa-pure',
      email: 'sa@webedu.vn',
      fullName: 'Pure SA',
      phone: '0909990000',
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    // Dual [TEACHER, STUDENT] cannot view Student B profile
    await expect(service.getStudentById(dualTeacherStudent, 'student-b')).rejects.toThrowError(
      new ForbiddenException('Bạn không có quyền truy cập hồ sơ của học viên khác'),
    );

    // Dual [TEACHER, STUDENT] viewing self sees internalNotes: null; Pure SUPERADMIN sees null; ADMIN sees real notes
    const selfView = await service.getStudentById(dualTeacherStudent, 'student-a');
    expect(selfView.internalNotes).toBeNull();
    const saView = await service.getStudentById(pureSuperadmin, 'student-a');
    expect(saView.internalNotes).toBeNull();
    const adminView = await service.getStudentById(adminActor, 'student-a');
    expect(adminView.internalNotes).toBe('Ghi chú A');

    // Dual [SUPERADMIN, STUDENT] cannot view Student B learning records or class history
    await expect(
      service.getStudentLearningRecords(dualSaStudent, 'student-b'),
    ).rejects.toThrowError(ForbiddenException);
    await expect(
      service.getStudentClassHistory(dualSaStudent, 'student-b'),
    ).rejects.toThrowError(ForbiddenException);

    // Unassigned TEACHER fails closed on Student B learning records
    await expect(
      service.getStudentLearningRecords(dualTeacherStudent, 'student-b'),
    ).rejects.toThrowError(
      new ForbiddenException(
        'Giáo viên chỉ được truy cập dữ liệu học tập của học viên thuộc lớp mình đang hoặc đã hoàn thành phụ trách',
      ),
    );
  });

  it('enforces SEC-08, SEC-07, tokenVersion on email change, and assignInitialClass invariants (P0-2)', async () => {
    // Make student-b dual-role [STUDENT, SUPERADMIN] and ACTIVE (only active SA in store)
    const saStudent = usersStore.get('student-b')!;
    saStudent.roles = [Role.STUDENT, Role.SUPERADMIN];
    saStudent.status = UserStatus.ACTIVE;

    // ADMIN cannot modify or assignInitialClass on SUPERADMIN/ADMIN student (SEC-08)
    await expect(
      service.updateStudent(adminActor, 'student-b', { fullName: 'Tampered' }),
    ).rejects.toThrowError(
      new ForbiddenException(
        'Admin không có quyền chỉnh sửa hoặc khóa tài khoản Quản trị viên / Quản trị tối cao',
      ),
    );

    const otherSuperadmin: AuthenticatedUser = {
      id: 'sa-other',
      email: 'other.sa@webedu.vn',
      fullName: 'Other SA',
      phone: '0909888777',
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    // Last active SUPERADMIN in store cannot be deactivated even by an actor with SUPERADMIN role
    await expect(
      service.updateStudent(otherSuperadmin, 'student-b', { status: UserStatus.INACTIVE }),
    ).rejects.toThrowError(
      new BadRequestException('Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động'),
    );

    // Changing email on student-a increments tokenVersion
    const beforeVer = usersStore.get('student-a')!.tokenVersion;
    await service.updateStudent(adminActor, 'student-a', { email: 'a.updated@example.com' });
    expect(usersStore.get('student-a')!.tokenVersion).toBe(beforeVer + 1);

    // assignInitialClass rejects invalid enrolledAt and already-ACTIVE students
    await expect(
      service.assignInitialClass(adminActor, 'student-a', {
        classNameOrId: 'HSK1-K21',
        enrolledAt: 'not-a-valid-date',
      }),
    ).rejects.toThrowError(BadRequestException);

    await service.assignInitialClass(adminActor, 'student-a', { classNameOrId: 'HSK1-K21' });
    await expect(
      service.assignInitialClass(adminActor, 'student-a', { classNameOrId: 'HSK1-K22' }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Chỉ có thể xếp lớp lần đầu cho học viên đang ở trạng thái Chờ xếp lớp',
      ),
    );
  });

  it('omits registeredAt/createdAt in student detail view (Cleanup #13) and formats guardianConsent display', async () => {
    const detail = await service.getStudentById(adminActor, 'student-a');
    expect('createdAt' in detail).toBe(false);
    expect('registeredAt' in detail).toBe(false);
    expect(detail.dateOfBirthLocked).toBe(true);
    expect(detail.guardianConsent?.formattedDisplay).toMatch(
      /^Đã xác nhận đồng ý của cha mẹ – \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
    );
  });

  it('blocks editing dateOfBirth when student already has GuardianConsent (FUNC-007)', async () => {
    await expect(
      service.updateStudent(adminActor, 'student-a', {
        dateOfBirth: '2011-03-10',
      }),
    ).rejects.toThrowError(
      new BadRequestException('Ngày sinh đã bị khóa sau khi xác nhận đồng ý của cha mẹ'),
    );
  });

  it('blocks editing dateOfBirth to < 16 at registration time when student has no GuardianConsent (FUNC-007)', async () => {
    // Student B registered on 2026-06-02. Setting DOB to 2012-01-01 makes age at registration 14 (< 16)
    await expect(
      service.updateStudent(adminActor, 'student-b', {
        dateOfBirth: '2012-01-01',
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Không thể sửa ngày sinh: học viên dưới 16 tuổi cần xác nhận đồng ý của cha mẹ khi đăng ký',
      ),
    );

    // Setting DOB to 2007-05-20 (age 19 at registration >= 16) is allowed
    const updated = await service.updateStudent(adminActor, 'student-b', {
      dateOfBirth: '2007-05-20',
    });
    expect(updated.dateOfBirth).toBe('2007-05-20');
  });

  it('returns only CONFIRMED or NOT_APPLICABLE in pending-enrollment queue (Cleanup #12) and transitions to ACTIVE on class assignment (FUNC-008)', async () => {
    const queue = await service.getPendingEnrollmentQueue();
    expect(queue.totalPending).toBe(2);
    const statuses = queue.items.map((i) => i.guardianConsentStatus);
    expect(statuses).toEqual(expect.arrayContaining(['CONFIRMED', 'NOT_APPLICABLE']));
    expect(statuses).not.toContain('MISSING');

    const enrolled = await service.assignInitialClass(adminActor, 'student-a', {
      classNameOrId: 'HSK1-K20',
    });
    expect(enrolled.status).toBe(UserStatus.ACTIVE);
    expect(enrolled.assignedClass).toBe('HSK1-K20');
    expect(enrolled.enrolledAt).toBeTruthy();
  });

  it('enforces DEC-024 on student class history: Student views own, Admin views all, Teacher is blocked from viewing past class history', async () => {
    const teacherActor: AuthenticatedUser = {
      id: 'teacher-1',
      email: 'teacher@webedu.vn',
      fullName: 'Teacher One',
      phone: '0903333333',
      roles: [Role.TEACHER],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    // Student A views own class history -> OK
    const ownHistory = await service.getStudentClassHistory(studentActorA, 'student-a');
    expect(ownHistory.studentId).toBe('student-a');

    // Student A views Student B class history -> 403
    await expect(
      service.getStudentClassHistory(studentActorA, 'student-b'),
    ).rejects.toThrowError(new ForbiddenException('Bạn không có quyền truy cập'));

    // Teacher views student past class history -> 403 (DEC-024)
    await expect(
      service.getStudentClassHistory(teacherActor, 'student-a'),
    ).rejects.toThrowError(
      new ForbiddenException('Giáo viên không có quyền xem lịch sử lớp cũ của học viên'),
    );

    // Admin views any student's class history -> OK (DEC-024)
    const adminView = await service.getStudentClassHistory(adminActor, 'student-b');
    expect(adminView.studentId).toBe('student-b');
  });

  it('enforces DEC-025 & DEC-026 on teacher access to completed vs reassigned classes', () => {
    const teacherOld: AuthenticatedUser = {
      id: 'teacher-old',
      email: 'old@webedu.vn',
      fullName: 'Old Teacher',
      phone: '0904444441',
      roles: [Role.TEACHER],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const teacherNew: AuthenticatedUser = {
      id: 'teacher-new',
      email: 'new@webedu.vn',
      fullName: 'New Teacher',
      phone: '0904444442',
      roles: [Role.TEACHER],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    // Case 1 (DEC-025): Class ended (COMPLETED), teacher in charge still has READ_ONLY view access
    expect(
      service.verifyClassLearningAccess(teacherOld, {
        classId: 'cls-1',
        assignedTeacherId: 'teacher-old',
        classStatus: 'COMPLETED',
      }),
    ).toEqual({ allowed: true, mode: 'READ_ONLY' });

    // Case 2 (DEC-025): Teacher was replaced by teacherNew -> teacherOld is blocked (403), teacherNew is allowed
    expect(() =>
      service.verifyClassLearningAccess(teacherOld, {
        classId: 'cls-2',
        assignedTeacherId: 'teacher-new',
        classStatus: 'ACTIVE',
      }),
    ).toThrowError(
      new ForbiddenException(
        'Giáo viên đã được thay thế không còn quyền truy cập lớp học này',
      ),
    );

    expect(
      service.verifyClassLearningAccess(teacherNew, {
        classId: 'cls-2',
        assignedTeacherId: 'teacher-new',
        classStatus: 'ACTIVE',
      }),
    ).toEqual({ allowed: true, mode: 'FULL' });

    // UPCOMING class also grants FULL mode to assigned teacher
    expect(
      service.verifyClassLearningAccess(teacherNew, {
        classId: 'cls-3',
        assignedTeacherId: 'teacher-new',
        classStatus: 'UPCOMING',
      }),
    ).toEqual({ allowed: true, mode: 'FULL' });

    // DEC-026: Admin has full operational access
    expect(
      service.verifyClassLearningAccess(adminActor, {
        classId: 'cls-2',
        assignedTeacherId: 'teacher-new',
        classStatus: 'ACTIVE',
      }),
    ).toEqual({ allowed: true, mode: 'FULL' });
  });
});
