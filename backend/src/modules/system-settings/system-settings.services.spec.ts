import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { SystemConfigService } from './services/system-config.service.js';
import { SystemUsersService } from './services/system-users.service.js';
import { UserRoleStatusService } from './services/user-role-status.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

interface SystemSettingsTestFacade {
  listSystemUsers: SystemUsersService['listSystemUsers'];
  createSystemUser: SystemUsersService['createSystemUser'];
  updateUserRolesAndStatus: UserRoleStatusService['updateUserRolesAndStatus'];
  getSystemConfig: SystemConfigService['getSystemConfig'];
  updateSystemConfig: SystemConfigService['updateSystemConfig'];
  listAuditLogs: SystemConfigService['listAuditLogs'];
}

describe('SystemSettings Services (Slice 2.4 - FUNC-013, SEC-07, SEC-09, SEC-10)', () => {
  let service: SystemSettingsTestFacade;

  interface MockSysUser {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    roles: Role[];
    status: UserStatus;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }

  let usersStore: Map<string, MockSysUser>;
  let settingsStore: Map<string, string>;
  let auditLogsStore: Array<Record<string, unknown>>;
  let mockPrisma: Record<string, unknown>;

  const superadminA: AuthenticatedUser = {
    id: 'sa-1',
    email: 'sa1@webedu.vn',
    fullName: 'Superadmin 1',
    phone: '0999000001',
    roles: [Role.SUPERADMIN],
    effectiveRole: Role.SUPERADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  const superadminB: AuthenticatedUser = {
    id: 'sa-2',
    email: 'sa2@webedu.vn',
    fullName: 'Superadmin 2',
    phone: '0999000002',
    roles: [Role.SUPERADMIN],
    effectiveRole: Role.SUPERADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  beforeEach(() => {
    usersStore = new Map();
    settingsStore = new Map();
    auditLogsStore = [];

    usersStore.set('sa-1', {
      id: 'sa-1',
      email: 'sa1@webedu.vn',
      phone: '0999000001',
      fullName: 'Superadmin 1',
      roles: [Role.SUPERADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    usersStore.set('sa-2', {
      id: 'sa-2',
      email: 'sa2@webedu.vn',
      phone: '0999000002',
      fullName: 'Superadmin 2',
      roles: [Role.SUPERADMIN],
      status: UserStatus.ACTIVE,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      user: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return usersStore.get(where.id) ?? null;
        }),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => Array.from(usersStore.values())),
        count: vi.fn(
          async ({
            where,
          }: {
            where?: {
              id?: { not: string };
              roles?: { has: Role };
              status?: UserStatus;
            };
          }) => {
            let count = 0;
            for (const u of usersStore.values()) {
              if (where?.id?.not && u.id === where.id.not) continue;
              if (where?.roles?.has && !u.roles.includes(where.roles.has)) continue;
              if (where?.status && u.status !== where.status) continue;
              count += 1;
            }
            return count;
          },
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `sys-${usersStore.size + 1}`;
          const now = new Date();
          const record: MockSysUser = {
            id,
            email: data.email as string,
            phone: data.phone as string,
            fullName: data.fullName as string,
            roles: data.roles as Role[],
            status: (data.status as UserStatus) ?? UserStatus.ACTIVE,
            tokenVersion: 0,
            createdAt: now,
            updatedAt: now,
          };
          usersStore.set(id, record);
          return record;
        }),
        update: vi.fn(
          async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const u = usersStore.get(where.id)!;
            if (Array.isArray(data.roles)) u.roles = data.roles as Role[];
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
      teacherProfile: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      systemSetting: {
        findMany: vi.fn(async () => {
          return Array.from(settingsStore.entries()).map(([key, value]) => ({
            key,
            value,
          }));
        }),
        upsert: vi.fn(
          async ({
            where,
            update,
            create,
          }: {
            where: { key: string };
            update: { value: string };
            create: { key: string; value: string };
          }) => {
            const val = update?.value ?? create.value;
            settingsStore.set(where.key, val);
            return { key: where.key, value: val };
          },
        ),
      },
      systemAuditLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const entry = {
            id: `log-${auditLogsStore.length + 1}`,
            createdAt: new Date(),
            ...data,
          };
          auditLogsStore.unshift(entry);
          return entry;
        }),
        findMany: vi.fn(async () => auditLogsStore),
        count: vi.fn(async () => auditLogsStore.length),
      },
      class: {
        count: vi.fn(async () => 0),
      },
      $transaction: (() => {
        let txQueue = Promise.resolve();
        return vi.fn(async (cb: (tx: Record<string, unknown>) => Promise<unknown>) => {
          const prev = txQueue;
          let release!: () => void;
          const curr = new Promise<void>((r) => {
            release = r;
          });
          txQueue = prev.then(() => curr);
          await prev;
          try {
            return await cb(mockPrisma);
          } finally {
            release();
          }
        });
      })(),
    };

    const prisma = mockPrisma as unknown as PrismaService;
    const usersService = new SystemUsersService(prisma);
    const roleStatusService = new UserRoleStatusService(prisma);
    const configService = new SystemConfigService(prisma);

    service = {
      listSystemUsers: usersService.listSystemUsers.bind(usersService),
      createSystemUser: usersService.createSystemUser.bind(usersService),
      updateUserRolesAndStatus:
        roleStatusService.updateUserRolesAndStatus.bind(roleStatusService),
      getSystemConfig: configService.getSystemConfig.bind(configService),
      updateSystemConfig: configService.updateSystemConfig.bind(configService),
      listAuditLogs: configService.listAuditLogs.bind(configService),
    };
  });

  it('prevents Superadmin from self-deactivating or self-removing SUPERADMIN role (FUNC-013)', async () => {
    await expect(
      service.updateUserRolesAndStatus(superadminA, 'sa-1', {
        status: UserStatus.INACTIVE,
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Không thể tự vô hiệu hóa chính mình hoặc gỡ vai trò Superadmin cuối cùng',
      ),
    );

    await expect(
      service.updateUserRolesAndStatus(superadminA, 'sa-1', {
        roles: [Role.ADMIN],
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Không thể tự vô hiệu hóa chính mình hoặc gỡ vai trò Superadmin cuối cùng',
      ),
    );
  });

  it('prevents Write-Skew race condition when two Superadmins concurrently demote/deactivate each other (SEC-07)', async () => {
    // SA-1 tries to deactivate SA-2 AND SA-2 tries to deactivate SA-1 simultaneously
    const results = await Promise.allSettled([
      service.updateUserRolesAndStatus(superadminA, 'sa-2', {
        status: UserStatus.INACTIVE,
      }),
      service.updateUserRolesAndStatus(superadminB, 'sa-1', {
        status: UserStatus.INACTIVE,
      }),
    ]);

    const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;
    const rejectedCount = results.filter((r) => r.status === 'rejected').length;

    // Strictly one succeeds and the second is blocked to preserve at least 1 active Superadmin!
    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const activeSuperadmins = Array.from(usersStore.values()).filter(
      (u) => u.roles.includes(Role.SUPERADMIN) && u.status === UserStatus.ACTIVE,
    );
    expect(activeSuperadmins).toHaveLength(1);
  });

  it('validates PNG/JPG magic bytes for center logo, rejects SVG XSS payload (SEC-09), and omits timezone field (Cleanup #15)', async () => {
    // Reject SVG disguised as data URI
    const svgBase64 = Buffer.from('<svg onload="alert(1)"></svg>').toString('base64');
    await expect(
      service.updateSystemConfig(superadminA, {
        centerName: 'Trung Tâm TD Hán Ngữ',
        centerLogoUrl: `data:image/svg+xml;base64,${svgBase64}`,
      }),
    ).rejects.toThrowError(BadRequestException);

    // Reject external https://*.png URL bypass (P1-2 / SEC-09)
    await expect(
      service.updateSystemConfig(superadminA, {
        centerName: 'Trung Tâm TD Hán Ngữ',
        centerLogoUrl: 'https://evil.example.com/fake-logo.png',
      }),
    ).rejects.toThrowError(BadRequestException);

    // Valid PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const validPngDataUri = `data:image/png;base64,${validPngBuffer.toString('base64')}`;

    const config = await service.updateSystemConfig(superadminA, {
      centerName: 'Trung Tâm TD Hán Ngữ Mới',
      centerLogoUrl: validPngDataUri,
    });

    expect(config.centerName).toBe('Trung Tâm TD Hán Ngữ Mới');
    expect(config.centerLogoUrl).toBe(validPngDataUri);
    // Cleanup #15: Strictly no timezone property in system config response
    expect('timezone' in config).toBe(false);
  });

  it('lists and creates system users while blocking empty roles, pure STUDENT creation, and duplicate contacts (FUNC-013)', async () => {
    const initialList = await service.listSystemUsers({ search: 'sa1', page: 1, limit: 10 });
    expect(initialList.total).toBe(2);

    await expect(
      service.createSystemUser(superadminA, {
        fullName: 'Nhân Sự Rỗng Vai Trò',
        phone: '0988111222',
        email: 'empty.roles@webedu.vn',
        initialPassword: 'Password@123',
        roles: [],
      }),
    ).rejects.toThrowError(
      new BadRequestException('Phải chọn ít nhất một vai trò'),
    );

    await expect(
      service.createSystemUser(superadminA, {
        fullName: 'Học Viên Trái Luồng',
        phone: '0988111223',
        email: 'pure.student@webedu.vn',
        initialPassword: 'Password@123',
        roles: [Role.STUDENT],
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Tài khoản Học viên phải được tạo qua luồng Đăng ký học viên để kiểm tra độ tuổi và đồng ý phụ huynh',
      ),
    );

    const createdDual = await service.createSystemUser(superadminA, {
      fullName: 'Admin Kiêm Giáo Viên',
      phone: '0988111224',
      email: 'dual.admin.teacher@webedu.vn',
      initialPassword: 'Password@123',
      roles: [Role.ADMIN, Role.TEACHER],
    });
    expect(createdDual.effectiveRole).toBe(Role.ADMIN);
    expect(createdDual.roles).toEqual([Role.ADMIN, Role.TEACHER]);
  });

  it('enforces role/status invariants for non-student PENDING_CLASS, pure student activation bypass, and active teacher demotion', async () => {
    const createdTeacher = await service.createSystemUser(superadminA, {
      fullName: 'Giáo Viên Đang Dạy',
      phone: '0988111225',
      email: 'active.teacher@webedu.vn',
      initialPassword: 'Password@123',
      roles: [Role.TEACHER],
    });

    await expect(
      service.updateUserRolesAndStatus(superadminA, createdTeacher.id, {
        status: UserStatus.PENDING_CLASS,
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Trạng thái Chờ xếp lớp chỉ áp dụng cho tài khoản Học viên',
      ),
    );

    (mockPrisma.class as { count: ReturnType<typeof vi.fn> }).count.mockResolvedValueOnce(2);
    await expect(
      service.updateUserRolesAndStatus(superadminA, createdTeacher.id, {
        roles: [Role.ADMIN],
      }),
    ).rejects.toThrowError(/Giáo viên đang phụ trách 2 lớp/);

    usersStore.set('pending-student-1', {
      id: 'pending-student-1',
      email: 'pending1@webedu.vn',
      phone: '0988111226',
      fullName: 'Học Viên Chờ Lớp',
      roles: [Role.STUDENT],
      status: UserStatus.PENDING_CLASS,
      tokenVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.updateUserRolesAndStatus(superadminA, 'pending-student-1', {
        status: UserStatus.ACTIVE,
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Tài khoản chờ xếp lớp chỉ được kích hoạt thông qua nghiệp vụ Xếp lớp ban đầu',
      ),
    );
  });

  it('rejects timezone and empty centerName on updateSystemConfig and paginates audit logs', async () => {
    await expect(
      service.updateSystemConfig(superadminA, {
        centerName: 'Trung Tâm TD Hán Ngữ',
        timezone: 'Asia/Bangkok',
      }),
    ).rejects.toThrowError(
      new BadRequestException(
        'Trường múi giờ đã bị loại bỏ khỏi cấu hình hệ thống',
      ),
    );

    await expect(
      service.updateSystemConfig(superadminA, {
        centerName: '   ',
      }),
    ).rejects.toThrowError(
      new BadRequestException('Tên trung tâm không được để trống'),
    );

    await service.updateSystemConfig(superadminA, {
      centerName: 'Trung Tâm TD Hán Ngữ',
      centerLogoUrl: null,
    });
    const logs = await service.listAuditLogs({ page: 1, limit: 10 });
    expect(logs.total).toBeGreaterThanOrEqual(1);
  });
});
