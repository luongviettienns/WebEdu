import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  PrismaClient,
  Role,
  UserStatus,
} from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '../..');

function resolvePostgresBinDir() {
  const candidates = [
    process.env.PG_BIN_DIR,
    'D:\\PostgresSQL\\bin',
    'C:\\Program Files\\PostgreSQL\\18\\bin',
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\16\\bin',
    '/usr/lib/postgresql/16/bin',
    '/usr/bin',
    '/usr/local/bin',
  ].filter(Boolean);

  const exeExt = process.platform === 'win32' ? '.exe' : '';
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, `pg_ctl${exeExt}`))) {
      return dir;
    }
  }
  return '';
}

function pgBin(binDir, tool) {
  const exeExt = process.platform === 'win32' ? '.exe' : '';
  return binDir ? path.join(binDir, `${tool}${exeExt}`) : `${tool}${exeExt}`;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr && typeof addr === 'object' ? addr.port : 55433;
      srv.close(() => resolve(port));
    });
  });
}

function decodeQuotedPrintable(input) {
  const unwrapped = input.replace(/=\r?\n/g, '');
  const bytes = [];
  for (let i = 0; i < unwrapped.length; i += 1) {
    const ch = unwrapped[i];
    if (
      ch === '=' &&
      i + 2 < unwrapped.length &&
      /^[0-9A-Fa-f]{2}$/.test(unwrapped.slice(i + 1, i + 3))
    ) {
      bytes.push(Number.parseInt(unwrapped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      for (const b of Buffer.from(ch, 'utf8')) {
        bytes.push(b);
      }
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

async function startQaSmtpAndInspector(smtpPort, inspectorPort, databaseUrl) {
  const messages = [];

  const smtpServer = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let buffer = '';
    let inDataMode = false;
    let mailFrom = '';
    let rcptTo = [];
    let dataLines = [];

    const sendLine = (line) => {
      if (!socket.destroyed) {
        socket.write(`${line}\r\n`);
      }
    };

    sendLine('220 localhost ESMTP WebEduQaSmtp');

    socket.on('data', (chunk) => {
      buffer += chunk;
      while (true) {
        const idx = buffer.indexOf('\n');
        if (idx === -1) break;
        const rawLine = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);

        if (inDataMode) {
          if (rawLine === '.') {
            inDataMode = false;
            const rawData = dataLines.join('\r\n');
            messages.push({
              mailFrom,
              rcptTo: [...rcptTo],
              rawData,
              decodedBody: decodeQuotedPrintable(rawData),
            });
            dataLines = [];
            sendLine('250 2.0.0 OK Message accepted');
          } else {
            dataLines.push(rawLine.startsWith('..') ? rawLine.slice(1) : rawLine);
          }
          continue;
        }

        const upper = rawLine.toUpperCase();
        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          sendLine('250-localhost Hello');
          sendLine('250 8BITMIME');
        } else if (upper.startsWith('MAIL FROM:')) {
          mailFrom = rawLine.slice(10).trim();
          rcptTo = [];
          dataLines = [];
          sendLine('250 2.1.0 Sender OK');
        } else if (upper.startsWith('RCPT TO:')) {
          rcptTo.push(rawLine.slice(8).trim());
          sendLine('250 2.1.5 Recipient OK');
        } else if (upper === 'DATA') {
          inDataMode = true;
          sendLine('354 Start mail input; end with <CRLF>.<CRLF>');
        } else if (upper === 'QUIT') {
          sendLine('221 2.0.0 Bye');
          socket.end();
        } else {
          sendLine('250 2.0.0 OK');
        }
      }
    });
  });

  await new Promise((resolve, reject) => {
    smtpServer.once('error', reject);
    smtpServer.listen(smtpPort, '127.0.0.1', () => resolve());
  });

  const inspectorServer = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && reqUrl.pathname === '/latest-token') {
      const email = (reqUrl.searchParams.get('email') ?? '').trim().toLowerCase();
      let foundToken = null;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (msg.rcptTo.some((r) => r.toLowerCase().includes(email))) {
          const match =
            /\/reset-password\?token=([0-9a-fA-F]{64})/.exec(msg.decodedBody) ??
            /\/reset-password\?token=([0-9a-fA-F]{64})/.exec(msg.rawData);
          foundToken = match?.[1] ?? null;
          break;
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: foundToken, totalMessages: messages.length }));
      return;
    }
    if (req.method === 'POST' && reqUrl.pathname === '/reset-rate-limits') {
      const prisma = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
      });
      try {
        await prisma.$executeRawUnsafe(
          'TRUNCATE TABLE "auth_rate_limits", "email_rate_limits" RESTART IDENTITY CASCADE',
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } finally {
        await prisma.$disconnect();
      }
      return;
    }
    if (req.method === 'POST' && reqUrl.pathname === '/reseed') {
      await seedQaFixtures(databaseUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve, reject) => {
    inspectorServer.once('error', reject);
    inspectorServer.listen(inspectorPort, '127.0.0.1', () => resolve());
  });

  return {
    stop: async () => {
      await new Promise((r) => inspectorServer.close(() => r()));
      await new Promise((r) => smtpServer.close(() => r()));
    },
  };
}

async function seedQaFixtures(databaseUrl) {
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$connect();

  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "system_audit_logs",
        "enrollments",
        "classes",
        "courses",
        "auth_rate_limits",
        "email_rate_limits",
        "email_verifications",
        "password_reset_tokens",
        "guardian_consents",
        "teacher_profiles",
        "student_profiles",
        "system_settings",
        "users"
      RESTART IDENTITY CASCADE
    `);

    const passwordHash = await bcrypt.hash('Password@123', 10);

    const superadmin = await prisma.user.create({
      data: {
        email: 'superadmin@webedu.vn',
        phone: '0909000001',
        fullName: 'Quản Trị Hệ Thống Cấp Cao',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.create({
      data: {
        email: 'sa.backup@webedu.vn',
        phone: '0909000002',
        fullName: 'Superadmin Dự Phòng',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.user.create({
      data: {
        email: 'admin@webedu.vn',
        phone: '0909000003',
        fullName: 'Nguyễn Quản Trị Đào Tạo',
        passwordHash,
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    const teacherLan = await prisma.user.create({
      data: {
        email: 'teacher.lan@webedu.vn',
        phone: '0909000004',
        fullName: 'Trương Mỹ Lan (张美兰)',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.teacherProfile.create({
      data: {
        userId: teacherLan.id,
        notes: 'Giảng viên HSK 1-4 (Hànyǔ Shuǐpíng Kǎoshì)',
      },
    });

    const teacherIdle = await prisma.user.create({
      data: {
        email: 'teacher.idle@webedu.vn',
        phone: '0909000005',
        fullName: 'Vương Quốc Tuấn',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.teacherProfile.create({
      data: {
        userId: teacherIdle.id,
        notes: 'Giảng viên thỉnh giảng chưa mở lớp',
      },
    });

    const courseHsk1 = await prisma.course.create({
      data: {
        code: 'HSK1',
        name: 'Tiếng Trung HSK 1 — 汉语水平考试一级 (Hànzì)',
        level: CourseLevel.HSK1,
      },
    });

    const courseHsk2 = await prisma.course.create({
      data: {
        code: 'HSK2',
        name: 'Tiếng Trung HSK 2 — 初级汉语口语 (Chūjí Hànyǔ)',
        level: CourseLevel.HSK2,
      },
    });

    await prisma.class.create({
      data: {
        code: 'HSK1-K26-01',
        courseId: courseHsk1.id,
        teacherId: teacherLan.id,
        status: ClassStatus.UPCOMING,
        startDate: new Date('2026-11-20T00:00:00.000Z'),
      },
    });

    const classHsk2 = await prisma.class.create({
      data: {
        code: 'HSK2-K26-01',
        courseId: courseHsk2.id,
        teacherId: teacherLan.id,
        status: ClassStatus.ACTIVE,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const vnYear = Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
      }).format(new Date()),
    );
    const teenDob = new Date(`${vnYear - 14}-01-01T00:00:00.000Z`);

    for (const suffix of ['desktop', 'mobile']) {
      const idx = suffix === 'desktop' ? '1' : '2';
      const pendingTeen = await prisma.user.create({
        data: {
          email: `pending.${suffix}@webedu.vn`,
          phone: `090910000${idx}`,
          fullName:
            suffix === 'desktop'
              ? 'Lê Minh Châu (黎明珠)'
              : 'Trần Bảo Ngọc (陈宝玉)',
          passwordHash,
          roles: [Role.STUDENT],
          status: UserStatus.PENDING_CLASS,
        },
      });
      const pendingProfile = await prisma.studentProfile.create({
        data: {
          userId: pendingTeen.id,
          dateOfBirth: teenDob,
          guardianEmail: `phuhuynh.${suffix}@example.com`,
          internalNotes: 'Học viên thiếu niên đã có xác nhận phụ huynh',
        },
      });
      await prisma.guardianConsent.create({
        data: {
          studentProfileId: pendingProfile.id,
          guardianEmail: `phuhuynh.${suffix}@example.com`,
          consentVersion: 'v1.0',
          consentTextSnapshot:
            'Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ cho phép đăng ký tài khoản học tập.',
          ipAddress: '127.0.0.1',
          userAgent: 'QA-Seed',
        },
      });

      const lockoutUser = await prisma.user.create({
        data: {
          email: `lockout.${suffix}@webedu.vn`,
          phone: `090920000${idx}`,
          fullName: `Đặng Kiểm Thử Khóa (${suffix})`,
          passwordHash,
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
        },
      });
      await prisma.studentProfile.create({
        data: {
          userId: lockoutUser.id,
          dateOfBirth: new Date('2002-02-02T00:00:00.000Z'),
        },
      });

      const resetUser = await prisma.user.create({
        data: {
          email: `reset.${suffix}@webedu.vn`,
          phone: `090930000${idx}`,
          fullName: `Hoàng Khôi Phục MK (${suffix})`,
          passwordHash,
          roles: [Role.STUDENT],
          status: UserStatus.ACTIVE,
        },
      });
      await prisma.studentProfile.create({
        data: {
          userId: resetUser.id,
          dateOfBirth: new Date('2001-11-11T00:00:00.000Z'),
        },
      });
    }

    const activeStudent = await prisma.user.create({
      data: {
        email: 'active.student@webedu.vn',
        phone: '0909000007',
        fullName: 'Phạm Gia Huy',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.studentProfile.create({
      data: {
        userId: activeStudent.id,
        dateOfBirth: new Date('2003-08-20T00:00:00.000Z'),
        assignedClass: 'HSK2-K26-01',
        currentClassId: classHsk2.id,
        enrolledAt: new Date('2026-10-01T00:00:00.000Z'),
        internalNotes: 'Ghi chú nội bộ mật chỉ Admin mới được xem',
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: activeStudent.id,
        classId: classHsk2.id,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    await prisma.systemAuditLog.create({
      data: {
        actorId: superadmin.id,
        actingRole: Role.SUPERADMIN,
        action: 'SEED_QA_ENVIRONMENT',
        targetType: 'System',
        targetId: 'qa-seed',
        metadata: { note: 'Khởi tạo dữ liệu kiểm thử trình duyệt Phase 2' },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const externalDbUrl = process.env.TEST_DATABASE_URL?.trim();
  const binDir = resolvePostgresBinDir();
  const cleanPgEnv = { ...process.env, LC_ALL: 'C', PGUSER: 'postgres' };

  let databaseUrl = externalDbUrl ?? '';
  let clusterRoot = '';
  let dataDir = '';

  const stopPgCluster = () => {
    if (!dataDir) return;
    try {
      execFileSync(
        pgBin(binDir, 'pg_ctl'),
        ['-D', dataDir, '-m', 'immediate', '-w', 'stop'],
        { env: cleanPgEnv, stdio: 'ignore' },
      );
    } catch {
      // Ignore
    }
    try {
      fs.rmSync(clusterRoot, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    dataDir = '';
  };

  try {
    if (!databaseUrl) {
      const pgPort = await findFreePort();
      clusterRoot = path.join(
        os.tmpdir(),
        `webedu-pg-qa-${crypto.randomUUID().slice(0, 8)}`,
      );
      dataDir = path.join(clusterRoot, 'data');
      const logFile = path.join(clusterRoot, 'postgres.log');
      fs.mkdirSync(clusterRoot, { recursive: true });

      execFileSync(
        pgBin(binDir, 'initdb'),
        ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale'],
        { env: cleanPgEnv, stdio: 'pipe' },
      );

      fs.appendFileSync(
        path.join(dataDir, 'postgresql.conf'),
        [
          '',
          "listen_addresses = '127.0.0.1'",
          `port = ${pgPort}`,
          'fsync = off',
          'synchronous_commit = off',
          'full_page_writes = off',
          'max_connections = 100',
          "timezone = 'Asia/Ho_Chi_Minh'",
          '',
        ].join('\n'),
        'utf8',
      );

      execFileSync(
        pgBin(binDir, 'pg_ctl'),
        ['-D', dataDir, '-l', logFile, '-w', 'start'],
        { env: cleanPgEnv, stdio: 'ignore' },
      );

      execFileSync(
        pgBin(binDir, 'createdb'),
        ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'postgres', 'webedu_test'],
        { env: cleanPgEnv, stdio: 'pipe' },
      );

      databaseUrl = `postgresql://postgres@127.0.0.1:${pgPort}/webedu_test?schema=public`;
    }

    const prismaCliJs = path.join(BACKEND_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
    execFileSync(process.execPath, [prismaCliJs, 'migrate', 'deploy'], {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    await seedQaFixtures(databaseUrl);

    const smtpPort = Number(process.env.QA_SMTP_PORT || 4025);
    const inspectorPort = Number(process.env.QA_MAIL_INSPECTOR_PORT || 4026);
    const mailServers = await startQaSmtpAndInspector(smtpPort, inspectorPort, databaseUrl);

    const backendChild = spawn(process.execPath, ['dist/main.js'], {
      cwd: BACKEND_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: '3001',
        DATABASE_URL: databaseUrl,
        JWT_SECRET: 'webedu-browser-qa-jwt-secret-key-at-least-32-chars-2026',
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3005',
        FRONTEND_APP_URL: process.env.FRONTEND_APP_URL || 'http://localhost:3005',
        MAIL_PROVIDER: 'smtp',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtpPort),
        SMTP_SECURE: 'false',
      },
      stdio: 'inherit',
    });

    let shuttingDown = false;
    const cleanup = async () => {
      if (shuttingDown) return;
      shuttingDown = true;

      if (!backendChild.killed) {
        backendChild.kill('SIGTERM');
      }
      await mailServers.stop();
      stopPgCluster();
    };

    process.on('SIGINT', async () => {
      await cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await cleanup();
      process.exit(0);
    });
    backendChild.on('exit', async (code) => {
      await cleanup();
      process.exit(code ?? 0);
    });
  } catch (err) {
    stopPgCluster();
    throw err;
  }
}

await main();
