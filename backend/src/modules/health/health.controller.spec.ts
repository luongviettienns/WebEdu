import { describe, it, expect, vi } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';

describe('HealthController', () => {
  it('should return health check payload with status ok when database is reachable', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    } as unknown as PrismaService;

    const statusSpy = vi.fn();
    const mockRes = {
      status: statusSpy,
    } as unknown as Response;

    const controller = new HealthController(mockPrisma);
    const result = await controller.check(mockRes);

    expect(result).toHaveProperty('status', 'ok');
    expect(result).toHaveProperty('service', 'webedu-backend');
    expect(result).toHaveProperty('database', 'ok');
    expect(result).toHaveProperty('timezone', 'Asia/Ho_Chi_Minh');
    expect(result).toHaveProperty('timestamp');
    expect(statusSpy).not.toHaveBeenCalled();
  });

  it('should return status degraded and 503 when database is unreachable', async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('DB Connection Refused')),
    } as unknown as PrismaService;

    const statusSpy = vi.fn();
    const mockRes = {
      status: statusSpy,
    } as unknown as Response;

    const controller = new HealthController(mockPrisma);
    const result = await controller.check(mockRes);

    expect(result).toHaveProperty('status', 'degraded');
    expect(result).toHaveProperty('database', 'unavailable');
    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
