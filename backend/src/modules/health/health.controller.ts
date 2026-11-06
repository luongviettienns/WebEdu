import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Check system health, database connectivity, and canonical timezone' })
  @ApiResponse({
    status: 200,
    description: 'Service and database are healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'webedu-backend' },
        database: { type: 'string', example: 'ok' },
        timezone: { type: 'string', example: 'Asia/Ho_Chi_Minh' },
        timestamp: { type: 'string', example: '2026-11-06T15:30:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Database is unavailable (service degraded)',
  })
  async check(@Res({ passthrough: true }) res: Response) {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'unavailable';
    }

    const isHealthy = database === 'ok';
    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'webedu-backend',
      database,
      timezone: 'Asia/Ho_Chi_Minh',
      timestamp: new Date().toISOString(),
    };
  }
}
