import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { TeachersService } from './teachers.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

describe('TeachersService (Slice 2.4 - FUNC-006)', () => {
  let service: TeachersService;

  interface MockTeacherUser {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    passwordHash: string;
    roles: Role[];
    status: UserStatus;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
    teacherProfile: {
      id: string;
      userId: string;
      notes: string | null;
      activeClassesCount: number;
    } | null;
  }

  let usersStore: Map<string, MockTeacherUser>;
  let auditLogs: Array<Record<string, unknown>>;
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

  beforeEach(() => {
    usersStore = new Map();
    auditLogs = [];

    mockPrisma = {
      $queryRaw: vi.fn(async () => {
        return Array.from(usersStore.values())
          .filter((u) => u.roles.includes(Role.SUPERADMIN) && u.status === UserStatus.ACTIVE)
          .map((u) => ({ id: u.id }));
      }),
      user: {
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          for (const u of usersStore.values()) {
            if (
              where.id &&
              typeof where.id === 'object' &&
              'not' in (where.id as Record<string, unknown>) &&
              u.id === (where.id as { not: string }).not
            ) {
              continue;
            }
            const ors = where.OR as Array<{ email?: string; phone?: string }> | undefined;
            if (ors) {
              for (const c of ors) {
                if (c.email && u.email === c.email) return u;
                if (c.phone && u.phone === c.phone) return u;
              }
            }
          }
          return null;
        }),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return usersStore.get(where.id) ?? null;
        }),
        findMany: vi.fn(async () => {
          return Array.from(usersStore.values()).sort((a, b) =>
            a.fullName.localeCompare(b.fullName),
          );
        }),
        count: vi.fn(async () => usersStore.size),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `teacher-${usersStore.size + 1}`;
          const now = new Date();
          const record: MockTeacherUser = {
            id,
            email: data.email as string,
            phone: data.phone as string,
            fullName: data.fullName as string,
            passwordHash: data.passwordHash as string,
            roles: (data.roles as Role[]) ?? [Role.TEACHER],
            status: (data.status as UserStatus) ?? UserStatus.ACTIVE,
            tokenVersion: 0,
            createdAt: now,
            updatedAt: now,
            teacherProfile: null,
          };
          usersStore.set(id, record);
          return record;
        }),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const record = usersStore.get(where.id);
            if (!record) throw new Error('Not found');
            if (typeof data.fullName === 'string') record.fullName = data.fullName;
            if (typeof data.phone === 'string') record.phone = data.phone;
            if (typeof data.email === 'string') record.email = data.email;
            if (typeof data.status === 'string') record.status = data.status as UserStatus;
            if (
              data.tokenVersion &&
              typeof data.tokenVersion === 'object' &&
              'increment' in data.tokenVersion
            ) {
              record.tokenVersion += Number(
                (data.tokenVersion as { increment: number }).increment,
              );
            }
            return record;
          },
        ),
      },
      teacherProfile: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const profile = {
            id: `tp-${usersStore.size}`,
            userId: data.userId as string,
            notes: (data.notes as string | null) ?? null,
            activeClassesCount: (data.activeClassesCount as number) ?? 0,
          };
          const u = usersStore.get(profile.userId);
          if (u) u.teacherProfile = profile;
          return profile;
        }),
        upsert: vi.fn(
          async ({
            where,
            update,
          }: {
            where: { userId: string };
            update: { notes?: string | null };
          }) => {
            const u = usersStore.get(where.userId);
            if (u && u.teacherProfile && update.notes !== undefined) {
              u.teacherProfile.notes = update.notes;
            }
            return u?.teacherProfile;
          },
        ),
      },
      systemAuditLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          auditLogs.push(data);
          return data;
        }),
      },
      class: {
        count: vi.fn(async () => 0),
      },
      $transaction: vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
        return cb(mockPrisma);
      }),
    };

    service = new TeachersService(mockPrisma as unknown as PrismaService);
  });

  it('creates teacher with status=ACTIVE (never PENDING_CLASS) and redacts initialPassword in audit log', async () => {
    const created = await service.createTeacher(adminActor, {
      fullName: 'Cô Giáo Lan',
      phone: '0911222333',
      email: 'Lan.Teacher@WebEdu.vn',
      initialPassword: 'SecretPassword123',
      notes: 'GV HSK 5',
    });

    expect(created.status).toBe(UserStatus.ACTIVE);
    expect(created.roles).toEqual([Role.TEACHER]);
    expect(created.isAdmin).toBe(false);
    expect(auditLogs).toHaveLength(1);
    expect((auditLogs[0]?.metadata as Record<string, unknown>)?.initialPassword).toBeUndefined();
    expect((auditLogs[0]?.metadata as Record<string, unknown>)?.hasInitialCredentials).toBe(true);
  });

  it('returns isAdmin=true flag for dual-role TEACHER+ADMIN in teacher list (Cleanup #16)', async () => {
    usersStore.set('t-dual', {
      id: 't-dual',
      email: 'dual@webedu.vn',
      phone: '0911000111',
      fullName: 'Thầy Minh Kiêm Admin',
      passwordHash: 'hash',
      roles: [Role.TEACHER, Role.ADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      teacherProfile: {
        id: 'tp-dual',
        userId: 't-dual',
        notes: null,
        activeClassesCount: 2,
      },
    });

    const list = await service.listTeachers({});
    expect(list.items[0]?.isAdmin).toBe(true);
    expect(list.items[0]?.activeClassesCount).toBe(2);
  });

  it('blocks deactivating teacher when activeClassesCount > 0 with 409 Conflict', async () => {
    const created = await service.createTeacher(adminActor, {
      fullName: 'Thầy Hùng',
      phone: '0911444555',
      email: 'hung@webedu.vn',
      initialPassword: 'SecretPassword123',
    });

    const record = usersStore.get(created.id)!;
    record.teacherProfile!.activeClassesCount = 3;

    await expect(
      service.updateTeacher(adminActor, created.id, { status: UserStatus.INACTIVE }),
    ).rejects.toThrowError(
      new ConflictException(
        'Giáo viên đang phụ trách 3 lớp. Vui lòng phân công giáo viên khác',
      ),
    );
  });

  it('blocks ADMIN from modifying or locking an account with SUPERADMIN role (SEC-08)', async () => {
    usersStore.set('sa-teacher', {
      id: 'sa-teacher',
      email: 'sa@webedu.vn',
      phone: '0911999999',
      fullName: 'Superadmin Teacher',
      passwordHash: 'hash',
      roles: [Role.TEACHER, Role.SUPERADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      teacherProfile: {
        id: 'tp-sa',
        userId: 'sa-teacher',
        notes: null,
        activeClassesCount: 0,
      },
    });

    await expect(
      service.updateTeacher(adminActor, 'sa-teacher', { status: UserStatus.INACTIVE }),
    ).rejects.toThrowError(ForbiddenException);
  });

  it('enforces SEC-08 on dual ADMIN teacher, SEC-07 on last Superadmin, rejects PENDING_CLASS, and increments tokenVersion on email change (P0-2)', async () => {
    usersStore.set('admin-teacher', {
      id: 'admin-teacher',
      email: 'adminteacher@webedu.vn',
      phone: '0911888888',
      fullName: 'Admin Teacher',
      passwordHash: 'hash',
      roles: [Role.TEACHER, Role.ADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      teacherProfile: {
        id: 'tp-at',
        userId: 'admin-teacher',
        notes: null,
        activeClassesCount: 0,
      },
    });

    // ADMIN cannot modify another ADMIN teacher
    await expect(
      service.updateTeacher(adminActor, 'admin-teacher', { fullName: 'Changed' }),
    ).rejects.toThrowError(
      new ForbiddenException(
        'Admin không có quyền chỉnh sửa hoặc khóa tài khoản Quản trị viên / Quản trị tối cao',
      ),
    );

    // Self-locking or locking the last SUPERADMIN teacher fails with 400
    usersStore.set('sa-teacher-only', {
      id: 'sa-teacher-only',
      email: 'sa.only@webedu.vn',
      phone: '0911777777',
      fullName: 'Last SA Teacher',
      passwordHash: 'hash',
      roles: [Role.TEACHER, Role.SUPERADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      teacherProfile: {
        id: 'tp-sa-only',
        userId: 'sa-teacher-only',
        notes: null,
        activeClassesCount: 0,
      },
    });

    const saSelfActor: AuthenticatedUser = {
      id: 'sa-teacher-only',
      email: 'sa.only@webedu.vn',
      fullName: 'Last SA Teacher',
      phone: '0911777777',
      roles: [Role.TEACHER, Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    await expect(
      service.updateTeacher(saSelfActor, 'sa-teacher-only', { status: UserStatus.INACTIVE }),
    ).rejects.toThrowError(
      new BadRequestException('Superadmin không thể tự vô hiệu hóa tài khoản của chính mình'),
    );

    const otherSaActor: AuthenticatedUser = {
      id: 'sa-external',
      email: 'sa.ext@webedu.vn',
      fullName: 'External SA',
      phone: '0911666666',
      roles: [Role.SUPERADMIN],
      effectiveRole: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
    };

    await expect(
      service.updateTeacher(otherSaActor, 'sa-teacher-only', { status: UserStatus.INACTIVE }),
    ).rejects.toThrowError(
      new BadRequestException('Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động'),
    );

    // Rejects PENDING_CLASS status on teacher
    const normalTeacher = await service.createTeacher(adminActor, {
      fullName: 'Cô Mai',
      phone: '0911555444',
      email: 'mai@webedu.vn',
      initialPassword: 'SecretPassword123',
    });

    await expect(
      service.updateTeacher(adminActor, normalTeacher.id, { status: UserStatus.PENDING_CLASS }),
    ).rejects.toThrowError(BadRequestException);

    // Changing teacher email increments tokenVersion
    const beforeVer = usersStore.get(normalTeacher.id)!.tokenVersion;
    await service.updateTeacher(adminActor, normalTeacher.id, {
      email: 'mai.new@webedu.vn',
      phone: '0911555333',
      notes: 'Cập nhật ghi chú',
    });
    expect(usersStore.get(normalTeacher.id)!.tokenVersion).toBe(beforeVer + 1);

    // updateTeacher throws 404 when not found and supports notes-only update
    await expect(
      service.updateTeacher(adminActor, 'missing-teacher', { fullName: 'X' }),
    ).rejects.toThrowError('Không tìm thấy giáo viên');

    const notesOnly = await service.updateTeacher(adminActor, normalTeacher.id, {
      notes: '   ',
    });
    expect(notesOnly.notes).toBeNull();

    // listTeachers with search and status filters
    const filtered = await service.listTeachers({
      search: 'Mai',
      status: UserStatus.ACTIVE,
      page: 1,
      limit: 10,
    });
    expect(filtered.items.length).toBeGreaterThan(0);
  });
});
