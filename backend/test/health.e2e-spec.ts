import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';

describe('Health & Global Error Filter (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: vi.fn().mockResolvedValue(undefined),
        $disconnect: vi.fn().mockResolvedValue(undefined),
        $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health returns 200 OK and valid health payload', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'webedu-backend',
        database: 'ok',
        timezone: 'Asia/Ho_Chi_Minh',
        timestamp: expect.any(String),
      }),
    );
  });

  it('GET /api/v1/non-existent-route returns 404 with RFC 7807 problem details format', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/non-existent-route')
      .expect(404);

    expect(response.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(response.body).toEqual(
      expect.objectContaining({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: expect.any(String),
        instance: '/api/v1/non-existent-route',
        timestamp: expect.any(String),
      }),
    );
  });
});
