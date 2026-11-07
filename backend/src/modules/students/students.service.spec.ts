import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { StudentsService } from './students.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

describe('StudentsService (FUNC-007, 008, 010, DEC-024..026)', () => {
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
      currentClassId: string | null;
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

  interface MockClassRecord {
    id: string;
    code: string;
    courseId: string;
    teacherId: string;
    status: ClassStatus;
    startDate: Date;
    course: { id: string; code: string; name: string; level: CourseLevel };
    teacher: { id: string; fullName: string };
  }

  interface MockEnrollmentRecord {
    id: string;
    classId: string;
    studentId: string;
    status: EnrollmentStatus;
    enrolledDate: Date;
    leftDate: Date | null;
  }

  let usersStore: Map<string, MockStudentUser>;
  let classesStore: Map<string, MockClassRecord>;
  let enrollmentsStore: MockEnrollmentRecord[];
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
    classesStore = new Map();
    enrollmentsStore = [];

    const defaultCourse = {
      id: 'course-hsk1',
      code: 'HSK1',
      name: 'Tiếng Trung HSK 1',
      level: CourseLevel.HSK1,
    };

    classesStore.set('cls-k20', {
      id: 'cls-k20',
      code: 'HSK1-K20',
      courseId: defaultCourse.id,
      teacherId: 'teacher-1',
      status: ClassStatus.UPCOMING,
      startDate: new Date('2026-12-01T00:00:00.000Z'),
      course: defaultCourse,
      teacher: { id: 'teacher-1', fullName: 'Cô Giáo Lan' },
    });

    classesStore.set('cls-k21', {
      id: 'cls-k21',
      code: 'HSK1-K21',
      courseId: defaultCourse.id,
      teacherId: 'teacher-1',
      status: ClassStatus.ACTIVE,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      course: defaultCourse,
      teacher: { id: 'teacher-1', fullName: 'Cô Giáo Lan' },
    });

    classesStore.set('cls-completed', {
      id: 'cls-completed',
      code: 'HSK1-OLD',
      courseId: defaultCourse.id,
      teacherId: 'teacher-1',
      status: ClassStatus.COMPLETED,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      course: defaultCourse,
      teacher: { id: 'teacher-1', fullName: 'Cô Giáo Lan' },
    });

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
        currentClassId: null,
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
        currentClassId: null,
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
        findMany: vi.fn(async ({ where }: { where?: { status?: UserStatus } }) => {
          return Array.from(usersStore.values()).filter((u) =>
            where?.status ? u.status === where.status : true,
          );
        }),
        count: vi.fn(async ({ where }: { where?: { status?: UserStatus } }) => {
          return Array.from(usersStore.values()).filter((u) =>
            where?.status ? u.status === where.status : true,
          ).length;
        }),
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
            if (typeof data.currentClassId === 'string') {
              u.studentProfile!.currentClassId = data.currentClassId;
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
      class: {
        findFirst: vi.fn(async ({ where }: { where: { code?: string; OR?: Array<{ id?: string; code?: string }> } }) => {
          for (const cls of classesStore.values()) {
            if (where.code && cls.code === where.code) return cls;
            if (where.OR) {
              for (const c of where.OR) {
                if ((c.id && cls.id === c.id) || (c.code && cls.code === c.code)) {
                  return cls;
                }
              }
            }
          }
          return null;
        }),
        findMany: vi.fn(async () => {
          return Array.from(classesStore.values())
            .filter((c) => c.status === ClassStatus.UPCOMING || c.status === ClassStatus.ACTIVE)
            .map((c) => ({
              ...c,
              _count: {
                enrollments: enrollmentsStore.filter(
                  (e) => e.classId === c.id && e.status === EnrollmentStatus.ACTIVE,
                ).length,
              },
            }));
        }),
      },
      enrollment: {
        count: vi.fn(
          async ({
            where,
          }: {
            where: {
              studentId: string;
              status?: EnrollmentStatus | { in: EnrollmentStatus[] };
              class?: {
                teacherId?: string;
                status?: ClassStatus | { in: ClassStatus[] };
              };
              OR?: Array<{
                status?: EnrollmentStatus | { in: EnrollmentStatus[] };
                class?: {
                  teacherId?: string;
                  status?: ClassStatus | { in: ClassStatus[] };
                };
              }>;
            };
          }) => {
            const matchClause = (
              e: MockEnrollmentRecord,
              clause: {
                status?: EnrollmentStatus | { in: EnrollmentStatus[] };
                class?: {
                  teacherId?: string;
                  status?: ClassStatus | { in: ClassStatus[] };
                };
              },
            ): boolean => {
              if (typeof clause.status === 'string' && e.status !== clause.status) {
                return false;
              }
              if (
                clause.status &&
                typeof clause.status === 'object' &&
                !clause.status.in.includes(e.status)
              ) {
                return false;
              }
              if (clause.class) {
                const cls = classesStore.get(e.classId);
                if (!cls) return false;
                if (clause.class.teacherId && cls.teacherId !== clause.class.teacherId) {
                  return false;
                }
                if (
                  typeof clause.class.status === 'string' &&
                  cls.status !== clause.class.status
                ) {
                  return false;
                }
                if (
                  clause.class.status &&
                  typeof clause.class.status === 'object' &&
                  !clause.class.status.in.includes(cls.status)
                ) {
                  return false;
                }
              }
              return true;
            };

            return enrollmentsStore.filter((e) => {
              if (e.studentId !== where.studentId) return false;
              if (!matchClause(e, where)) return false;
              if (where.OR && !where.OR.some((c) => matchClause(e, c))) return false;
              return true;
            }).length;
          },
        ),
        findFirst: vi.fn(
          async ({ where }: { where: { studentId: string; status: EnrollmentStatus } }) => {
            return (
              enrollmentsStore.find(
                (e) => e.studentId === where.studentId && e.status === where.status,
              ) ?? null
            );
          },
        ),
        findMany: vi.fn(
          async ({
            where,
          }: {
            where: {
              studentId: string;
              status?: EnrollmentStatus | { in: EnrollmentStatus[] };
              class?: {
                teacherId?: string;
                status?: ClassStatus | { in: ClassStatus[] };
              };
              OR?: Array<{
                status?: EnrollmentStatus | { in: EnrollmentStatus[] };
                class?: {
                  teacherId?: string;
                  status?: ClassStatus | { in: ClassStatus[] };
                };
              }>;
            };
          }) => {
            const matchClause = (
              e: MockEnrollmentRecord,
              clause: {
                status?: EnrollmentStatus | { in: EnrollmentStatus[] };
                class?: {
                  teacherId?: string;
                  status?: ClassStatus | { in: ClassStatus[] };
                };
              },
            ): boolean => {
              if (typeof clause.status === 'string' && e.status !== clause.status) {
                return false;
              }
              if (
                clause.status &&
                typeof clause.status === 'object' &&
                !clause.status.in.includes(e.status)
              ) {
                return false;
              }
              if (clause.class) {
                const cls = classesStore.get(e.classId);
                if (!cls) return false;
                if (clause.class.teacherId && cls.teacherId !== clause.class.teacherId) {
                  return false;
                }
                if (
                  typeof clause.class.status === 'string' &&
                  cls.status !== clause.class.status
                ) {
                  return false;
                }
                if (
                  clause.class.status &&
                  typeof clause.class.status === 'object' &&
                  !clause.class.status.in.includes(cls.status)
                ) {
                  return false;
                }
              }
              return true;
            };

            return enrollmentsStore
              .filter((e) => {
                if (e.studentId !== where.studentId) return false;
                if (!matchClause(e, where)) return false;
                if (where.OR && !where.OR.some((c) => matchClause(e, c))) return false;
                return true;
              })
              .map((e) => ({
                ...e,
                class: classesStore.get(e.classId)!,
              }));
          },
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const dupActive = enrollmentsStore.find(
            (e) =>
              e.studentId === (data.studentId as string) &&
              e.status === EnrollmentStatus.ACTIVE &&
              data.status === EnrollmentStatus.ACTIVE,
          );
          if (dupActive) {
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          const rec: MockEnrollmentRecord = {
            id: `enr-${enrollmentsStore.length + 1}`,
            classId: data.classId as string,
            studentId: data.studentId as string,
            status: data.status as EnrollmentStatus,
            enrolledDate: data.enrolledDate as Date,
            leftDate: null,
          };
          enrollmentsStore.push(rec);
          return rec;
        }),
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

  it('enforces positive multi-role RBAC on getStudentById, blocks pure SUPERADMIN from reading or writing internalNotes, and enforces learning records RBAC', async () => {
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

    await expect(service.getStudentById(dualTeacherStudent, 'student-b')).rejects.toThrowError(
      new ForbiddenException('Bạn không có quyền truy cập hồ sơ của học viên khác'),
    );

    const selfView = await service.getStudentById(dualTeacherStudent, 'student-a');
    expect(selfView.internalNotes).toBeNull();
    const saView = await service.getStudentById(pureSuperadmin, 'student-a');
    expect(saView.internalNotes).toBeNull();
    const adminView = await service.getStudentById(adminActor, 'student-a');
    expect(adminView.internalNotes).toBe('Ghi chú A');

    // Pure SUPERADMIN cannot modify internalNotes (FUNC-007 / FUNC-013)
    await expect(
      service.updateStudent(pureSuperadmin, 'student-a', {
        internalNotes: 'Attempted tamper',
      }),
    ).rejects.toThrowError(
      new ForbiddenException(
        'Chỉ Quản trị viên (Admin) mới có quyền xem hoặc cập nhật ghi chú học vụ nội bộ',
      ),
    );
    expect(usersStore.get('student-a')!.studentProfile!.internalNotes).toBe('Ghi chú A');

    await expect(
      service.getStudentLearningRecords(dualSaStudent, 'student-b'),
    ).rejects.toThrowError(ForbiddenException);
    await expect(
      service.getStudentClassHistory(dualSaStudent, 'student-b'),
    ).rejects.toThrowError(ForbiddenException);

    await expect(
      service.getStudentLearningRecords(dualTeacherStudent, 'student-b'),
    ).rejects.toThrowError(
      new ForbiddenException(
        'Giáo viên chỉ được truy cập dữ liệu học tập của học viên thuộc lớp mình đang hoặc đã hoàn thành phụ trách',
      ),
    );
  });

  it('forbids bypassing enrollment via updateStudent (PENDING_CLASS -> ACTIVE or PENDING_CLASS -> INACTIVE -> ACTIVE) and validates real Class on assignInitialClass (FUNC-008)', async () => {
    // Direct bypass PENDING_CLASS -> ACTIVE via PATCH /students/:id is blocked
    await expect(
      service.updateStudent(adminActor, 'student-a', { status: UserStatus.ACTIVE }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Tài khoản chờ xếp lớp chỉ được kích hoạt thông qua nghiệp vụ Xếp lớp ban đầu',
      ),
    );

    // Two-step bypass PENDING_CLASS -> INACTIVE -> ACTIVE without enrollment is also blocked
    await service.updateStudent(adminActor, 'student-a', { status: UserStatus.INACTIVE });
    await expect(
      service.updateStudent(adminActor, 'student-a', { status: UserStatus.ACTIVE }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Tài khoản chờ xếp lớp chỉ được kích hoạt thông qua nghiệp vụ Xếp lớp ban đầu',
      ),
    );
    // Restore to PENDING_CLASS for initial enrollment test
    await service.updateStudent(adminActor, 'student-a', { status: UserStatus.PENDING_CLASS });

    // Non-existent class -> 404
    await expect(
      service.assignInitialClass(adminActor, 'student-a', {
        classNameOrId: 'HSK9-NONEXISTENT',
      }),
    ).rejects.toThrowError(new NotFoundException('Lớp học không tồn tại trong hệ thống'));

    // Completed class -> 400
    await expect(
      service.assignInitialClass(adminActor, 'student-a', {
        classNameOrId: 'HSK1-OLD',
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Chỉ có thể xếp học viên vào lớp Sắp mở (UPCOMING) hoặc Đang học (ACTIVE)',
      ),
    );
  });

  it('enforces SEC-08, SEC-07, tokenVersion on email change, and assignInitialClass invariants', async () => {
    const saStudent = usersStore.get('student-b')!;
    saStudent.roles = [Role.STUDENT, Role.SUPERADMIN];
    saStudent.status = UserStatus.ACTIVE;

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

    await expect(
      service.updateStudent(otherSuperadmin, 'student-b', { status: UserStatus.INACTIVE }),
    ).rejects.toThrowError(
      new BadRequestException('Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động'),
    );

    const beforeVer = usersStore.get('student-a')!.tokenVersion;
    await service.updateStudent(adminActor, 'student-a', { email: 'a.updated@example.com' });
    expect(usersStore.get('student-a')!.tokenVersion).toBe(beforeVer + 1);

    await expect(
      service.assignInitialClass(adminActor, 'student-a', {
        classNameOrId: 'HSK1-K21',
        enrolledAt: 'not-a-valid-date',
      }),
    ).rejects.toThrowError(BadRequestException);

    const assigned = await service.assignInitialClass(adminActor, 'student-a', {
      classNameOrId: 'HSK1-K21',
    });
    expect(assigned.currentClassId).toBe('cls-k21');
    expect(assigned.assignedClass).toBe('HSK1-K21');

    // Once enrolled, cannot revert back to PENDING_CLASS via updateStudent
    await expect(
      service.updateStudent(adminActor, 'student-a', { status: UserStatus.PENDING_CLASS }),
    ).rejects.toThrowError(
      new BadRequestException('Không thể chuyển học viên đã xếp lớp về lại trạng thái Chờ xếp lớp'),
    );

    await expect(
      service.assignInitialClass(adminActor, 'student-a', { classNameOrId: 'HSK1-K20' }),
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
    await expect(
      service.updateStudent(adminActor, 'student-b', {
        dateOfBirth: '2012-01-01',
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Không thể sửa ngày sinh: học viên dưới 16 tuổi cần xác nhận đồng ý của cha mẹ khi đăng ký',
      ),
    );

    const updated = await service.updateStudent(adminActor, 'student-b', {
      dateOfBirth: '2007-05-20',
    });
    expect(updated.dateOfBirth).toBe('2007-05-20');
  });

  it('returns only CONFIRMED or NOT_APPLICABLE in pending-enrollment queue and lists available UPCOMING/ACTIVE classes (FUNC-008)', async () => {
    const available = await service.listAvailableClasses();
    expect(available.items.map((c) => c.code)).toEqual(['HSK1-K20', 'HSK1-K21']);

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

  it('enforces DEC-024 & DEC-025 on real Enrollment & Class records', async () => {
    const teacher1: AuthenticatedUser = {
      id: 'teacher-1',
      email: 'teacher@webedu.vn',
      fullName: 'Cô Giáo Lan',
      phone: '0903333333',
      roles: [Role.TEACHER],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    const teacher2: AuthenticatedUser = {
      id: 'teacher-2',
      email: 'teacher2@webedu.vn',
      fullName: 'Thầy Minh',
      phone: '0903333334',
      roles: [Role.TEACHER],
      effectiveRole: Role.TEACHER,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    await service.assignInitialClass(adminActor, 'student-a', {
      classNameOrId: 'HSK1-K21',
    });

    // Assigned teacher can view learning records of student in their class
    const teacherRecords = await service.getStudentLearningRecords(teacher1, 'student-a');
    expect(teacherRecords.records).toHaveLength(1);
    expect(teacherRecords.records[0]?.accessMode).toBe('FULL');

    // Case 1 (DEC-025): Class finishes (COMPLETED), teacher was NOT replaced -> READ_ONLY access
    classesStore.get('cls-k21')!.status = ClassStatus.COMPLETED;
    const completedRecords = await service.getStudentLearningRecords(teacher1, 'student-a');
    expect(completedRecords.records[0]?.accessMode).toBe('READ_ONLY');

    // Case 2 (DEC-025): Teacher is replaced by teacher-2 -> teacher-1 gets 403, teacher-2 gets access
    classesStore.get('cls-k21')!.status = ClassStatus.ACTIVE;
    classesStore.get('cls-k21')!.teacherId = 'teacher-2';
    await expect(
      service.getStudentLearningRecords(teacher1, 'student-a'),
    ).rejects.toThrowError(ForbiddenException);
    const newTeacherRecords = await service.getStudentLearningRecords(teacher2, 'student-a');
    expect(newTeacherRecords.records).toHaveLength(1);

    // DEC-024: Even current teacher cannot view student's past class history
    await expect(
      service.getStudentClassHistory(teacher2, 'student-a'),
    ).rejects.toThrowError(
      new ForbiddenException('Giáo viên không có quyền xem lịch sử lớp cũ của học viên'),
    );

    const ownHistory = await service.getStudentClassHistory(studentActorA, 'student-a');
    expect(ownHistory.studentId).toBe('student-a');
    const adminHistory = await service.getStudentClassHistory(adminActor, 'student-a');
    expect(adminHistory.currentClass).toBe('HSK1-K21');

    // FUNC-011 & DEC-024/025: When student TRANSFERRED or DROPPED out of ongoing class, teacher loses operational access
    enrollmentsStore[0]!.status = EnrollmentStatus.DROPPED;
    usersStore.get('student-a')!.studentProfile!.currentClassId = null;
    await expect(
      service.getStudentLearningRecords(teacher2, 'student-a'),
    ).rejects.toThrowError(ForbiddenException);

    // Post-drop INACTIVE -> ACTIVE reactivation via updateStudent is blocked when no ACTIVE/COMPLETED enrollment remains
    await service.updateStudent(adminActor, 'student-a', {
      status: UserStatus.INACTIVE,
    });
    await expect(
      service.updateStudent(adminActor, 'student-a', {
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Tài khoản chờ xếp lớp chỉ được kích hoạt thông qua nghiệp vụ Xếp lớp ban đầu',
      ),
    );
  });
});
