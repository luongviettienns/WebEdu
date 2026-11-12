import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Response } from 'supertest';
import { configureAppSecurityAndPipes } from '../../src/common/http/configure-app.util.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import {
  startIsolatedPostgresTestDb,
  type IsolatedPostgresHarness,
} from './postgres-test-container.js';
import { LocalSmtpTestServer } from './local-smtp-server.js';

export interface RealE2eAppHarness {
  app: NestExpressApplication;
  prisma: PrismaService;
  pgHarness: IsolatedPostgresHarness;
  smtpServer: LocalSmtpTestServer;
  resetState: () => Promise<void>;
  stop: () => Promise<void>;
}

export interface ExtractedCookieSession {
  cookiePair: string;
  rawSetCookie: string;
  jwtToken: string;
}

export function extractAuthCookie(res: Response): ExtractedCookieSession {
  const body = res.body as Record<string, unknown> | undefined;
  if (body && 'accessToken' in body && body.accessToken !== undefined) {
    throw new Error('Security regression: accessToken must NOT be exposed in JSON response body');
  }

  const header = res.headers['set-cookie'];
  const list = Array.isArray(header)
    ? header
    : typeof header === 'string'
      ? [header]
      : [];

  const matched = list.find((item) => item.startsWith('webedu_access_token='));
  if (!matched) {
    throw new Error(`Expected Set-Cookie with webedu_access_token, got: ${JSON.stringify(header)}`);
  }

  const cookiePair = matched.split(';')[0]!;
  const jwtToken = decodeURIComponent(cookiePair.slice('webedu_access_token='.length));
  return {
    cookiePair,
    rawSetCookie: matched,
    jwtToken,
  };
}

export async function createRealE2eAppHarness(): Promise<RealE2eAppHarness> {
  const pgHarness = await startIsolatedPostgresTestDb();
  const smtpServer = new LocalSmtpTestServer();
  const smtpAddr = await smtpServer.start();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = pgHarness.databaseUrl;
  process.env.JWT_SECRET = 'webedu-e2e-real-postgres-jwt-secret-key-2026';
  process.env.CORS_ORIGIN = 'http://localhost:3000';
  process.env.FRONTEND_APP_URL = 'http://localhost:3000';
  process.env.MAIL_PROVIDER = 'smtp';
  process.env.SMTP_HOST = smtpAddr.host;
  process.env.SMTP_PORT = String(smtpAddr.port);
  process.env.SMTP_SECURE = 'false';

  const { AppModule } = await import('../../src/app.module.js');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    rawBody: false,
  });
  configureAppSecurityAndPipes(app, {
    nodeEnv: 'test',
    allowedOrigins: ['http://localhost:3000'],
  });
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    pgHarness,
    smtpServer,
    resetState: async () => {
      smtpServer.setSimulateFailure(false);
      smtpServer.clearMessages();
      await pgHarness.truncateAllTables(prisma);
    },
    stop: async () => {
      await app.close();
      await smtpServer.stop();
      await pgHarness.stop();
    },
  };
}
