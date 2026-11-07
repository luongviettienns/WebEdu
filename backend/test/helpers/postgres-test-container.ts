import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '../..');

export interface IsolatedPostgresHarness {
  databaseUrl: string;
  isEphemeralCluster: boolean;
  truncateAllTables: (prisma: PrismaClient) => Promise<void>;
  stop: () => Promise<void>;
}

function resolvePostgresBinDir(): string {
  const candidates = [
    process.env.PG_BIN_DIR,
    'D:\\PostgresSQL\\bin',
    'C:\\Program Files\\PostgreSQL\\18\\bin',
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\16\\bin',
    '/usr/lib/postgresql/16/bin',
    '/usr/bin',
    '/usr/local/bin',
  ].filter((item): item is string => Boolean(item));

  const exeExt = process.platform === 'win32' ? '.exe' : '';
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, `pg_ctl${exeExt}`))) {
      return dir;
    }
  }
  return '';
}

function pgBin(binDir: string, tool: string): string {
  const exeExt = process.platform === 'win32' ? '.exe' : '';
  return binDir ? path.join(binDir, `${tool}${exeExt}`) : `${tool}${exeExt}`;
}

async function findFreeLocalPort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : 55432;
      server.close(() => resolve(port));
    });
  });
}

function runPrismaMigrateDeploy(databaseUrl: string): void {
  const prismaCliJs = path.join(
    BACKEND_ROOT,
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );

  execFileSync(process.execPath, [prismaCliJs, 'migrate', 'deploy'], {
    cwd: BACKEND_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  });
}

export async function startIsolatedPostgresTestDb(): Promise<IsolatedPostgresHarness> {
  const externalTestDbUrl = process.env.TEST_DATABASE_URL?.trim();

  const truncateAllTables = async (prisma: PrismaClient): Promise<void> => {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "system_audit_logs",
        "enrollments",
        "classes",
        "courses",
        "email_rate_limits",
        "password_reset_tokens",
        "guardian_consents",
        "teacher_profiles",
        "student_profiles",
        "system_settings",
        "users"
      RESTART IDENTITY CASCADE
    `);
  };

  if (externalTestDbUrl) {
    runPrismaMigrateDeploy(externalTestDbUrl);
    return {
      databaseUrl: externalTestDbUrl,
      isEphemeralCluster: false,
      truncateAllTables,
      stop: async () => {
        // Managed externally (e.g. GitHub Actions postgres service or docker-compose.test.yml)
      },
    };
  }

  const binDir = resolvePostgresBinDir();
  const port = await findFreeLocalPort();
  const clusterRoot = path.join(
    os.tmpdir(),
    `webedu-pg-test-${crypto.randomUUID().slice(0, 8)}`,
  );
  const dataDir = path.join(clusterRoot, 'data');
  const logFile = path.join(clusterRoot, 'postgres.log');
  fs.mkdirSync(clusterRoot, { recursive: true });

  const cleanPgEnv: NodeJS.ProcessEnv = {
    ...process.env,
    LC_ALL: 'C',
    PGUSER: 'postgres',
  };

  execFileSync(
    pgBin(binDir, 'initdb'),
    ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale'],
    { env: cleanPgEnv, stdio: 'pipe' },
  );

  // Tune ephemeral cluster for fast local test execution
  fs.appendFileSync(
    path.join(dataDir, 'postgresql.conf'),
    [
      '',
      "listen_addresses = '127.0.0.1'",
      `port = ${port}`,
      'fsync = off',
      'synchronous_commit = off',
      'full_page_writes = off',
      'max_connections = 100',
      "timezone = 'Asia/Ho_Chi_Minh'",
      '',
    ].join('\n'),
    'utf8',
  );

  // Use stdio: 'ignore' on Windows so spawned postgres.exe does not inherit
  // open stdout/stderr pipe handles and block execFileSync indefinitely.
  execFileSync(
    pgBin(binDir, 'pg_ctl'),
    ['-D', dataDir, '-l', logFile, '-w', 'start'],
    { env: cleanPgEnv, stdio: 'ignore' },
  );

  try {
    execFileSync(
      pgBin(binDir, 'createdb'),
      ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'webedu_test'],
      { env: cleanPgEnv, stdio: 'pipe' },
    );

    const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/webedu_test?schema=public`;
    runPrismaMigrateDeploy(databaseUrl);

    let stopped = false;
    return {
      databaseUrl,
      isEphemeralCluster: true,
      truncateAllTables,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        try {
          execFileSync(
            pgBin(binDir, 'pg_ctl'),
            ['-D', dataDir, '-m', 'immediate', '-w', 'stop'],
            { env: cleanPgEnv, stdio: 'ignore' },
          );
        } catch {
          // Ignore if already stopped
        }
        try {
          fs.rmSync(clusterRoot, { recursive: true, force: true });
        } catch {
          // Ignore Windows file-handle delay on tmp cleanup
        }
      },
    };
  } catch (err) {
    try {
      execFileSync(
        pgBin(binDir, 'pg_ctl'),
        ['-D', dataDir, '-m', 'immediate', '-w', 'stop'],
        { env: cleanPgEnv, stdio: 'ignore' },
      );
    } catch {
      // Ignore cleanup failure
    }
    throw err;
  }
}
