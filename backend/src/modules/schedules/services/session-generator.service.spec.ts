import { BadRequestException } from '@nestjs/common';
import { Prisma, Role, SessionChangeAction, SessionStatus, SessionType, UserStatus } from '@prisma/client';
import { vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { SessionGeneratorService } from './session-generator.service.js';

function makeAdminActor(): AuthenticatedUser {
  return {
    id: 'admin-1',
    email: 'admin@webedu.vn',
    phone: '0900000001',
    fullName: 'Admin Trung Tâm',
    roles: [Role.ADMIN],
    effectiveRole: Role.ADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('SessionGeneratorService (TDD Slice 4.1)', () => {
  let service: SessionGeneratorService;
  let createManyMock: ReturnType<typeof vi.fn>;
  let deleteManyMock: ReturnType<typeof vi.fn>;
  let findManyMock: ReturnType<typeof vi.fn>;
  let findFirstMock: ReturnType<typeof vi.fn>;
  let classUpdateMock: ReturnType<typeof vi.fn>;
  let changeLogCreateMock: ReturnType<typeof vi.fn>;
  let queryRawMock: ReturnType<typeof vi.fn>;
  let executeRawMock: ReturnType<typeof vi.fn>;
  let tx: Prisma.TransactionClient;

  beforeEach(() => {
    service = new SessionGeneratorService();
    createManyMock = vi.fn().mockResolvedValue({ count: 3 });
    deleteManyMock = vi.fn().mockResolvedValue({ count: 0 });
    findManyMock = vi.fn().mockResolvedValue([]);
    findFirstMock = vi.fn().mockResolvedValue({ sessionDate: new Date('2026-11-16T00:00:00.000Z') });
    classUpdateMock = vi.fn().mockResolvedValue({});
    changeLogCreateMock = vi.fn().mockResolvedValue({});
    queryRawMock = vi.fn().mockResolvedValue([]);
    executeRawMock = vi.fn().mockResolvedValue(1);

    tx = {
      $queryRaw: queryRawMock,
      $executeRaw: executeRawMock,
      lessonSession: {
        createMany: createManyMock,
        deleteMany: deleteManyMock,
        findMany: findManyMock,
        findFirst: findFirstMock,
      },
      sessionChangeLog: {
        create: changeLogCreateMock,
      },
      class: {
        update: classUpdateMock,
      },
    } as unknown as Prisma.TransactionClient;
  });

  it('generates N REGULAR SCHEDULED sessions sequentially along T2-T4-T6 and logs GENERATE', async () => {
    // 2026-11-02 is Monday (T2)
    const lastDate = await service.generateInitialSessionsForClass(tx, makeAdminActor(), {
      id: 'class-1',
      code: 'HSK1-K26-01',
      startDate: new Date('2026-11-02T00:00:00.000Z'),
      scheduleDays: [1, 3, 5],
      scheduleStartTime: '18:00',
      scheduleEndTime: '19:30',
      totalSessions: 4,
    });

    expect(createManyMock).toHaveBeenCalledTimes(1);
    const payload = createManyMock.mock.calls[0]![0].data as Array<{
      sessionNumber: number;
      sessionDate: Date;
      status: SessionStatus;
      type: SessionType;
    }>;
    expect(payload).toHaveLength(4);
    expect(payload.map((s) => s.sessionNumber)).toEqual([1, 2, 3, 4]);
    expect(payload.map((s) => s.sessionDate.toISOString().slice(0, 10))).toEqual([
      '2026-11-02',
      '2026-11-04',
      '2026-11-06',
      '2026-11-09',
    ]);
    expect(payload.every((s) => s.status === SessionStatus.SCHEDULED && s.type === SessionType.REGULAR)).toBe(true);
    expect(lastDate.toISOString().slice(0, 10)).toBe('2026-11-09');
    expect(changeLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: SessionChangeAction.GENERATE,
          classId: 'class-1',
        }),
      }),
    );
  });

  it('skips regeneration when recurring schedule rule did not change', async () => {
    const startDate = new Date('2026-11-02T00:00:00.000Z');
    const expectedEndDate = new Date('2026-11-09T00:00:00.000Z');
    const result = await service.reconcileRecurringSessionsAfterRuleUpdate(tx, makeAdminActor(), {
      classId: 'class-1',
      classCode: 'HSK1-K26-01',
      previousRule: {
        startDate,
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        totalSessions: 4,
        expectedEndDate,
      },
      nextRule: {
        startDate,
        scheduleDays: [5, 1, 3],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        totalSessions: 4,
      },
    });

    expect(result.regeneratedCount).toBe(0);
    expect(deleteManyMock).not.toHaveBeenCalled();
    expect(createManyMock).not.toHaveBeenCalled();
    expect(changeLogCreateMock).not.toHaveBeenCalled();
  });

  it('preserves COMPLETED/CANCELLED/RESCHEDULED sessions and deletes only untouched SCHEDULED regular sessions', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'sess-completed',
        type: SessionType.REGULAR,
        status: SessionStatus.COMPLETED,
        sessionDate: new Date('2026-11-02T00:00:00.000Z'),
        startTime: '18:00',
        endTime: '19:30',
        isRescheduled: false,
        isMakeup: false,
      },
      {
        id: 'sess-rescheduled',
        type: SessionType.REGULAR,
        status: SessionStatus.SCHEDULED,
        sessionDate: new Date('2026-11-12T00:00:00.000Z'),
        startTime: '18:30',
        endTime: '20:00',
        isRescheduled: true,
        isMakeup: false,
      },
      {
        id: 'sess-untouched',
        type: SessionType.REGULAR,
        status: SessionStatus.SCHEDULED,
        sessionDate: new Date('2026-11-04T00:00:00.000Z'),
        startTime: '18:00',
        endTime: '19:30',
        isRescheduled: false,
        isMakeup: false,
      },
    ]);

    const result = await service.reconcileRecurringSessionsAfterRuleUpdate(tx, makeAdminActor(), {
      classId: 'class-1',
      classCode: 'HSK1-K26-01',
      previousRule: {
        startDate: new Date('2026-11-02T00:00:00.000Z'),
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        totalSessions: 3,
        expectedEndDate: new Date('2026-11-06T00:00:00.000Z'),
      },
      nextRule: {
        startDate: new Date('2026-11-02T00:00:00.000Z'),
        scheduleDays: [2, 4], // T3 - T5 (Nov 3, Nov 5, Nov 10, Nov 12...)
        scheduleStartTime: '18:30',
        scheduleEndTime: '20:00',
        totalSessions: 4,
      },
    });

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['sess-untouched'] } },
    });
    expect(result.regeneratedCount).toBe(2); // 4 total - 2 preserved active = 2 needed
    const inserted = createManyMock.mock.calls[0]![0].data as Array<{ sessionDate: Date }>;
    // After completed 2026-11-02 -> day after is 2026-11-03 (Tue), skips 2026-11-12 (already overlapped with rescheduled 18:30-20:00)
    expect(inserted.map((s) => s.sessionDate.toISOString().slice(0, 10))).toEqual([
      '2026-11-03',
      '2026-11-05',
    ]);
    expect(executeRawMock).toHaveBeenCalledTimes(2);
    expect(changeLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: SessionChangeAction.UPDATE_RECURRING_RULE,
        }),
      }),
    );
  });

  it('rejects reducing totalSessions below count of preserved active sessions', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 's1',
        type: SessionType.REGULAR,
        status: SessionStatus.COMPLETED,
        sessionDate: new Date('2026-11-02T00:00:00.000Z'),
        startTime: '18:00',
        endTime: '19:30',
        isRescheduled: false,
        isMakeup: false,
      },
      {
        id: 's2',
        type: SessionType.REGULAR,
        status: SessionStatus.COMPLETED,
        sessionDate: new Date('2026-11-04T00:00:00.000Z'),
        startTime: '18:00',
        endTime: '19:30',
        isRescheduled: false,
        isMakeup: false,
      },
    ]);

    await expect(
      service.reconcileRecurringSessionsAfterRuleUpdate(tx, makeAdminActor(), {
        classId: 'class-1',
        classCode: 'HSK1-K26-01',
        previousRule: {
          startDate: new Date('2026-11-02T00:00:00.000Z'),
          scheduleDays: [1, 3],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          totalSessions: 4,
          expectedEndDate: new Date('2026-11-11T00:00:00.000Z'),
        },
        nextRule: {
          startDate: new Date('2026-11-02T00:00:00.000Z'),
          scheduleDays: [1, 3],
          scheduleStartTime: '18:00',
          scheduleEndTime: '19:30',
          totalSessions: 1,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
