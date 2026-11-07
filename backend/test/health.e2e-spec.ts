import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import {
  createRealE2eAppHarness,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';

describe('Health & Global Error Filter (e2e — Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;

  beforeAll(async () => {
    harness = await createRealE2eAppHarness();
  });

  afterAll(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  it('GET /api/v1/health returns 200 OK against real PostgreSQL with database="ok"', async () => {
    const response = await request(harness.app.getHttpServer())
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
    const response = await request(harness.app.getHttpServer())
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
