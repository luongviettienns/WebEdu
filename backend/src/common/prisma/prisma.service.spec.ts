import { describe, it, expect, vi } from 'vitest';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('calls $connect when onModuleInit is invoked', async () => {
    const service = new PrismaService();
    const connectSpy = vi.spyOn(service, '$connect').mockResolvedValue(undefined as never);

    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();
  });

  it('calls $disconnect when onModuleDestroy is invoked', async () => {
    const service = new PrismaService();
    const disconnectSpy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined as never);

    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
