import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { SystemSettingsService } from './system-settings.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

describe('SystemSettingsService (Slice 2.4 - FUNC-013, SEC-07, SEC-09, SEC-10)', () => {
  let service: SystemSettingsService;

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

    service = new SystemSettingsService(mockPrisma as unknown as PrismaService);
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
});
