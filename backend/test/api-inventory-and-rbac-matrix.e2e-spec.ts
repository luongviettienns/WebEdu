import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  UserStatus,
} from '@prisma/client';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';
import { obtainVerificationCodeViaHttp } from './helpers/auth-test-helpers.js';

/**
 * Canonical 72-endpoint inventory through Phase 5 (`docs/test-inventory-api.md`).
 * Any route added to a NestJS controller that is not listed here will fail
 * the self-check test in Step 2B.API.2 / Step 3.A.
 */
export const DECLARED_PHASE2_API_INVENTORY: ReadonlyArray<{
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  isPublic: boolean;
}> = [
  // HealthController (1)
  { method: 'GET', path: '/api/v1/health', isPublic: true },
  // AuthController (8)
  { method: 'POST', path: '/api/v1/auth/register', isPublic: true },
  { method: 'POST', path: '/api/v1/auth/register/student', isPublic: true },
  { method: 'POST', path: '/api/v1/auth/send-verification-code', isPublic: true },
  { method: 'POST', path: '/api/v1/auth/login', isPublic: true },
  { method: 'POST', path: '/api/v1/auth/forgot-password', isPublic: true },
  { method: 'POST', path: '/api/v1/auth/reset-password', isPublic: true },
  { method: 'GET', path: '/api/v1/auth/me', isPublic: false },
  { method: 'POST', path: '/api/v1/auth/logout', isPublic: false },
  // ProfileController (4)
  { method: 'GET', path: '/api/v1/profile/me', isPublic: false },
  { method: 'PATCH', path: '/api/v1/profile/me', isPublic: false },
  { method: 'POST', path: '/api/v1/profile/me/send-email-change-code', isPublic: false },
  { method: 'POST', path: '/api/v1/profile/change-password', isPublic: false },
  // TeachersController (3)
  { method: 'GET', path: '/api/v1/teachers', isPublic: false },
  { method: 'POST', path: '/api/v1/teachers', isPublic: false },
  { method: 'PATCH', path: '/api/v1/teachers/:id', isPublic: false },
  // StudentsController (8)
  { method: 'GET', path: '/api/v1/students', isPublic: false },
  { method: 'GET', path: '/api/v1/students/pending-enrollment', isPublic: false },
  { method: 'GET', path: '/api/v1/students/available-classes', isPublic: false },
  { method: 'GET', path: '/api/v1/students/:id', isPublic: false },
  { method: 'PATCH', path: '/api/v1/students/:id', isPublic: false },
  { method: 'POST', path: '/api/v1/students/:id/assign-initial-class', isPublic: false },
  { method: 'GET', path: '/api/v1/students/:id/learning-records', isPublic: false },
  { method: 'GET', path: '/api/v1/students/:id/class-history', isPublic: false },
  // SystemSettingsController (6)
  { method: 'GET', path: '/api/v1/system-settings/users', isPublic: false },
  { method: 'POST', path: '/api/v1/system-settings/users', isPublic: false },
  { method: 'PATCH', path: '/api/v1/system-settings/users/:id/roles', isPublic: false },
  { method: 'GET', path: '/api/v1/system-settings/config', isPublic: true },
  { method: 'PUT', path: '/api/v1/system-settings/config', isPublic: false },
  { method: 'GET', path: '/api/v1/system-settings/audit-logs', isPublic: false },
  // CoursesController (3)
  { method: 'GET', path: '/api/v1/courses', isPublic: false },
  { method: 'POST', path: '/api/v1/courses', isPublic: false },
  { method: 'PATCH', path: '/api/v1/courses/:id', isPublic: false },
  // ClassesController (10)
  { method: 'GET', path: '/api/v1/classes', isPublic: false },
  { method: 'POST', path: '/api/v1/classes/preview-schedule', isPublic: false },
  { method: 'GET', path: '/api/v1/classes/:id', isPublic: false },
  { method: 'POST', path: '/api/v1/classes', isPublic: false },
  { method: 'PATCH', path: '/api/v1/classes/:id', isPublic: false },
  { method: 'POST', path: '/api/v1/classes/:id/enrollments', isPublic: false },
  { method: 'POST', path: '/api/v1/classes/:id/enrollments/:studentId/transfer', isPublic: false },
  { method: 'POST', path: '/api/v1/classes/:id/enrollments/:studentId/drop', isPublic: false },
  { method: 'POST', path: '/api/v1/classes/:id/complete', isPublic: false },
  { method: 'POST', path: '/api/v1/classes/:id/reopen', isPublic: false },
  // SchedulesController (8 — Phase 4)
  { method: 'GET', path: '/api/v1/schedules/calendar', isPublic: false },
  { method: 'GET', path: '/api/v1/schedules/change-logs', isPublic: false },
  { method: 'GET', path: '/api/v1/classes/:classId/sessions', isPublic: false },
  { method: 'POST', path: '/api/v1/classes/:classId/sessions', isPublic: false },
  { method: 'GET', path: '/api/v1/sessions/:sessionId', isPublic: false },
  { method: 'PATCH', path: '/api/v1/sessions/:sessionId/reschedule', isPublic: false },
  { method: 'POST', path: '/api/v1/sessions/:sessionId/cancel', isPublic: false },
  { method: 'POST', path: '/api/v1/sessions/:sessionId/makeup', isPublic: false },
  // AttendanceController (4 — Phase 4)
  { method: 'GET', path: '/api/v1/sessions/:sessionId/attendance', isPublic: false },
  { method: 'PUT', path: '/api/v1/sessions/:sessionId/attendance', isPublic: false },
  { method: 'GET', path: '/api/v1/classes/:classId/attendance/matrix', isPublic: false },
  { method: 'GET', path: '/api/v1/attendance/me', isPublic: false },
  // AssessmentsController (17 — Phase 5)
  { method: 'POST', path: '/api/v1/assessments/import', isPublic: false },
  { method: 'GET', path: '/api/v1/assessments/:id/review', isPublic: false },
  { method: 'GET', path: '/api/v1/assessments/:id/original', isPublic: false },
  { method: 'GET', path: '/api/v1/assessments/:id/media', isPublic: false },
  { method: 'POST', path: '/api/v1/assessments/:id/media', isPublic: false },
  { method: 'GET', path: '/api/v1/assessments/:id/media/:mediaId', isPublic: false },
  { method: 'POST', path: '/api/v1/assessments', isPublic: false },
  { method: 'GET', path: '/api/v1/assessments', isPublic: false },
  { method: 'GET', path: '/api/v1/assessments/:id', isPublic: false },
  { method: 'PATCH', path: '/api/v1/assessments/:id', isPublic: false },
  { method: 'DELETE', path: '/api/v1/assessments/:id', isPublic: false },
  { method: 'POST', path: '/api/v1/assessments/:id/duplicate', isPublic: false },
  { method: 'POST', path: '/api/v1/assessments/:id/publish', isPublic: false },
  { method: 'POST', path: '/api/v1/assessments/:id/questions', isPublic: false },
  { method: 'PUT', path: '/api/v1/assessments/:id/questions/reorder', isPublic: false },
  { method: 'PATCH', path: '/api/v1/assessments/:id/questions/:qid', isPublic: false },
  { method: 'DELETE', path: '/api/v1/assessments/:id/questions/:qid', isPublic: false },
];

interface ExpressRouteLayer {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
  };
  handle?: {
    stack?: ExpressRouteLayer[];
  };
}

function extractRegisteredExpressRoutes(
  expressInstance: unknown,
): Array<{ method: string; path: string }> {
  const inst = expressInstance as {
    _router?: { stack?: ExpressRouteLayer[] };
    router?: { stack?: ExpressRouteLayer[] };
  };
  const stack = inst._router?.stack ?? inst.router?.stack ?? [];
  const discovered = new Set<string>();

  const visitLayers = (layers: ExpressRouteLayer[]) => {
    for (const layer of layers) {
      if (layer.route?.path && layer.route.methods) {
        for (const [m, enabled] of Object.entries(layer.route.methods)) {
          const upper = m.toUpperCase();
          if (enabled && upper !== 'HEAD' && upper !== 'OPTIONS' && upper !== '_ALL') {
            discovered.add(`${upper} ${layer.route.path}`);
          }
        }
      }
      if (layer.handle?.stack) {
        visitLayers(layer.handle.stack);
      }
    }
  };

  visitLayers(stack);
  return Array.from(discovered)
    .sort()
    .map((entry) => {
      const [method, path] = entry.split(' ');
      return { method: method!, path: path! };
    });
}

function assertRfc7807ProblemDetails(body: Record<string, unknown>, expectedStatus: number): void {
  expect(body.status).toBe(expectedStatus);
  expect(body.type).toBe('about:blank');
  expect(typeof body.title).toBe('string');
  expect(typeof body.detail).toBe('string');
  expect(typeof body.instance).toBe('string');
  expect(typeof body.timestamp).toBe('string');

  // Must NEVER leak stack trace, Prisma internals, or raw SQL
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('PrismaClient');
  expect(serialized).not.toContain('SELECT ');
  expect(serialized).not.toContain('INSERT INTO');
}

describe('API Inventory Self-Check, Full RBAC Matrix & Contract Hardening (Real PostgreSQL)', () => {
  let harness: RealE2eAppHarness;

  beforeAll(async () => {
    harness = await createRealE2eAppHarness();
  });

  afterAll(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  beforeEach(async () => {
    await harness.resetState();
  });

  it('Step 2B.API.2 & Step 3.A: Self-checks that every live NestJS route matches DECLARED_PHASE2_API_INVENTORY 1-to-1', () => {
    const httpAdapter = harness.app.getHttpAdapter();
    const expressInstance = httpAdapter.getInstance();
    const actualRoutes = extractRegisteredExpressRoutes(expressInstance);

    const declaredRoutes = DECLARED_PHASE2_API_INVENTORY.map((item) => ({
      method: item.method,
      path: item.path,
    })).sort((a, b) =>
      `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`),
    );

    expect(actualRoutes).toEqual(declaredRoutes);
    expect(actualRoutes).toHaveLength(72);
  });

  it('Step 3.A: Enforces complete RBAC × Data-State matrix across all protected endpoints (Unauthenticated, Revoked, INACTIVE, STUDENT, TEACHER 4 states, ADMIN, pure SUPERADMIN, Multi-Role)', async () => {
    const server = harness.app.getHttpServer();
    const passwordHash = await bcrypt.hash('Password123', 10);

    // Seed actors across all roles and data states
    const pureSuperadmin = await harness.prisma.user.create({
      data: {
        email: 'pure.sa@webedu.vn',
        phone: '0900000001',
        fullName: 'Pure Superadmin',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    await harness.prisma.user.create({
      data: {
        email: 'backup.sa@webedu.vn',
        phone: '0900000002',
        fullName: 'Backup Superadmin',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    await harness.prisma.user.create({
      data: {
        email: 'dual.sa.admin@webedu.vn',
        phone: '0900000003',
        fullName: 'Dual SA + Admin',
        passwordHash,
        roles: [Role.SUPERADMIN, Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    await harness.prisma.user.create({
      data: {
        email: 'admin@webedu.vn',
        phone: '0900000004',
        fullName: 'Pure Admin',
        passwordHash,
        roles: [Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    const activeTeacher = await harness.prisma.user.create({
      data: {
        email: 'teacher.active@webedu.vn',
        phone: '0900000005',
        fullName: 'Active Class Teacher',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: { activeClassesCount: 1 } },
      },
    });

    const completedTeacher = await harness.prisma.user.create({
      data: {
        email: 'teacher.completed@webedu.vn',
        phone: '0900000006',
        fullName: 'Completed Class Teacher',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: { activeClassesCount: 0 } },
      },
    });

    await harness.prisma.user.create({
      data: {
        email: 'teacher.replaced@webedu.vn',
        phone: '0900000007',
        fullName: 'Replaced Former Teacher',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: { activeClassesCount: 0 } },
      },
    });

    await harness.prisma.user.create({
      data: {
        email: 'teacher.unassigned@webedu.vn',
        phone: '0900000008',
        fullName: 'Unassigned Teacher',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
        teacherProfile: { create: { activeClassesCount: 0 } },
      },
    });

    // Seed Course + Classes + Students + Enrollments for DEC-024 / DEC-025 verification
    const course = await harness.prisma.course.create({
      data: {
        code: 'HSK2',
        name: 'HSK 2 Standard',
        level: CourseLevel.HSK2,
      },
    });

    const activeClass = await harness.prisma.class.create({
      data: {
        code: 'HSK2-A',
        status: ClassStatus.ACTIVE,
        courseId: course.id,
        teacherId: activeTeacher.id, // Replaced teacher.replaced!
        startDate: new Date('2026-09-01T00:00:00.000Z'),
      },
    });

    const completedClass = await harness.prisma.class.create({
      data: {
        code: 'HSK1-OLD',
        status: ClassStatus.COMPLETED,
        courseId: course.id,
        teacherId: completedTeacher.id,
        startDate: new Date('2026-01-15T00:00:00.000Z'),
        actualEndDate: new Date('2026-06-01T00:00:00.000Z'),
      },
    });

    const studentA = await harness.prisma.user.create({
      data: {
        email: 'student.a@webedu.vn',
        phone: '0900000009',
        fullName: 'Student A',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
        studentProfile: {
          create: {
            dateOfBirth: new Date('2004-05-10T00:00:00.000Z'),
            assignedClass: 'HSK2-A',
            currentClassId: activeClass.id,
            internalNotes: 'Confidential internal note for Student A',
          },
        },
      },
    });

    const studentBCompleted = await harness.prisma.user.create({
      data: {
        email: 'student.b@webedu.vn',
        phone: '0900000011',
        fullName: 'Student B Completed',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.ACTIVE,
        studentProfile: {
          create: {
            dateOfBirth: new Date('2004-08-12T00:00:00.000Z'),
            assignedClass: 'HSK1-OLD',
            currentClassId: null,
          },
        },
      },
    });

    const studentPending = await harness.prisma.user.create({
      data: {
        email: 'student.pending@webedu.vn',
        phone: '0900000010',
        fullName: 'Student Pending',
        passwordHash,
        roles: [Role.STUDENT],
        status: UserStatus.PENDING_CLASS,
        studentProfile: {
          create: {
            dateOfBirth: new Date('2005-08-20T00:00:00.000Z'),
          },
        },
      },
    });

    await harness.prisma.enrollment.create({
      data: {
        studentId: studentA.id,
        classId: activeClass.id,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    await harness.prisma.enrollment.create({
      data: {
        studentId: studentBCompleted.id,
        classId: completedClass.id,
        status: EnrollmentStatus.COMPLETED,
        enrolledDate: new Date('2026-01-15T00:00:00.000Z'),
        leftDate: new Date('2026-06-01T00:00:00.000Z'),
      },
    });

    const loginAs = async (email: string): Promise<string> => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123' })
        .expect(200);
      return extractAuthCookie(res).jwtToken;
    };

    const saToken = await loginAs('pure.sa@webedu.vn');
    const dualSaAdminToken = await loginAs('dual.sa.admin@webedu.vn');
    const adminToken = await loginAs('admin@webedu.vn');
    const activeTeacherToken = await loginAs('teacher.active@webedu.vn');
    const completedTeacherToken = await loginAs('teacher.completed@webedu.vn');
    const replacedTeacherToken = await loginAs('teacher.replaced@webedu.vn');
    const unassignedTeacherToken = await loginAs('teacher.unassigned@webedu.vn');
    const studentAToken = await loginAs('student.a@webedu.vn');
    const studentPendingToken = await loginAs('student.pending@webedu.vn');

    // 1. All 21 protected endpoints MUST return 401 when unauthenticated
    const nilId = '00000000-0000-0000-0000-000000000000';
    const protectedEndpoints: Array<{
      method: 'get' | 'post' | 'put' | 'patch' | 'delete';
      url: string;
    }> = [
      { method: 'get', url: '/api/v1/auth/me' },
      { method: 'post', url: '/api/v1/auth/logout' },
      { method: 'get', url: '/api/v1/profile/me' },
      { method: 'patch', url: '/api/v1/profile/me' },
      { method: 'post', url: '/api/v1/profile/me/send-email-change-code' },
      { method: 'post', url: '/api/v1/profile/change-password' },
      { method: 'get', url: '/api/v1/teachers' },
      { method: 'post', url: '/api/v1/teachers' },
      { method: 'patch', url: `/api/v1/teachers/${activeTeacher.id}` },
      { method: 'get', url: '/api/v1/students' },
      { method: 'get', url: '/api/v1/students/pending-enrollment' },
      { method: 'get', url: '/api/v1/students/available-classes' },
      { method: 'get', url: `/api/v1/students/${studentA.id}` },
      { method: 'patch', url: `/api/v1/students/${studentA.id}` },
      { method: 'post', url: `/api/v1/students/${studentPending.id}/assign-initial-class` },
      { method: 'get', url: `/api/v1/students/${studentA.id}/learning-records` },
      { method: 'get', url: `/api/v1/students/${studentA.id}/class-history` },
      { method: 'get', url: '/api/v1/system-settings/users' },
      { method: 'post', url: '/api/v1/system-settings/users' },
      { method: 'patch', url: `/api/v1/system-settings/users/${pureSuperadmin.id}/roles` },
      { method: 'put', url: '/api/v1/system-settings/config' },
      { method: 'get', url: '/api/v1/system-settings/audit-logs' },
      { method: 'get', url: '/api/v1/courses' },
      { method: 'post', url: '/api/v1/courses' },
      { method: 'patch', url: `/api/v1/courses/${course.id}` },
      { method: 'get', url: '/api/v1/classes' },
      { method: 'get', url: `/api/v1/classes/${activeClass.id}` },
      { method: 'post', url: '/api/v1/classes' },
      { method: 'patch', url: `/api/v1/classes/${activeClass.id}` },
      { method: 'post', url: `/api/v1/classes/${activeClass.id}/enrollments` },
      { method: 'post', url: `/api/v1/classes/${activeClass.id}/enrollments/${studentA.id}/transfer` },
      { method: 'post', url: `/api/v1/classes/${activeClass.id}/enrollments/${studentA.id}/drop` },
      { method: 'post', url: `/api/v1/classes/${activeClass.id}/complete` },
      { method: 'post', url: `/api/v1/classes/${completedClass.id}/reopen` },
      { method: 'get', url: '/api/v1/schedules/calendar?from=2026-11-01&to=2026-11-30' },
      { method: 'get', url: '/api/v1/schedules/change-logs' },
      { method: 'get', url: `/api/v1/classes/${activeClass.id}/sessions` },
      { method: 'post', url: `/api/v1/classes/${activeClass.id}/sessions` },
      { method: 'get', url: '/api/v1/sessions/00000000-0000-0000-0000-000000000000' },
      { method: 'patch', url: '/api/v1/sessions/00000000-0000-0000-0000-000000000000/reschedule' },
      { method: 'post', url: '/api/v1/sessions/00000000-0000-0000-0000-000000000000/cancel' },
      { method: 'post', url: '/api/v1/sessions/00000000-0000-0000-0000-000000000000/makeup' },
      { method: 'get', url: '/api/v1/sessions/00000000-0000-0000-0000-000000000000/attendance' },
      { method: 'put', url: '/api/v1/sessions/00000000-0000-0000-0000-000000000000/attendance' },
      { method: 'get', url: `/api/v1/classes/${activeClass.id}/attendance/matrix` },
      { method: 'get', url: '/api/v1/attendance/me' },
      { method: 'get', url: '/api/v1/assessments' },
      { method: 'post', url: '/api/v1/assessments' },
      { method: 'post', url: '/api/v1/assessments/import' },
      { method: 'get', url: `/api/v1/assessments/${nilId}` },
      { method: 'patch', url: `/api/v1/assessments/${nilId}` },
      { method: 'delete', url: `/api/v1/assessments/${nilId}` },
      { method: 'get', url: `/api/v1/assessments/${nilId}/review` },
      { method: 'get', url: `/api/v1/assessments/${nilId}/original` },
      { method: 'get', url: `/api/v1/assessments/${nilId}/media` },
      { method: 'post', url: `/api/v1/assessments/${nilId}/media` },
      { method: 'get', url: `/api/v1/assessments/${nilId}/media/${nilId}` },
      { method: 'post', url: `/api/v1/assessments/${nilId}/duplicate` },
      { method: 'post', url: `/api/v1/assessments/${nilId}/publish` },
      { method: 'post', url: `/api/v1/assessments/${nilId}/questions` },
      { method: 'put', url: `/api/v1/assessments/${nilId}/questions/reorder` },
      { method: 'patch', url: `/api/v1/assessments/${nilId}/questions/${nilId}` },
      { method: 'delete', url: `/api/v1/assessments/${nilId}/questions/${nilId}` },
    ];

    for (const ep of protectedEndpoints) {
      const res = await request(server)[ep.method](ep.url);
      expect(res.status, `Unauthenticated ${ep.method.toUpperCase()} ${ep.url}`).toBe(401);
      assertRfc7807ProblemDetails(res.body, 401);
    }

    // 2. STUDENT role boundaries & IDOR protection (own vs other)
    await request(server)
      .get(`/api/v1/students/${studentA.id}`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    await request(server)
      .get(`/api/v1/students/${studentA.id}/learning-records`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    await request(server)
      .get(`/api/v1/students/${studentA.id}/class-history`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);

    for (const forbiddenUrl of [
      '/api/v1/students',
      '/api/v1/students/pending-enrollment',
      '/api/v1/students/available-classes',
      `/api/v1/students/${studentPending.id}`,
      `/api/v1/students/${studentPending.id}/class-history`,
      `/api/v1/students/${studentPending.id}/learning-records`,
      '/api/v1/teachers',
      '/api/v1/courses',
      '/api/v1/classes',
      `/api/v1/classes/${activeClass.id}`,
      '/api/v1/system-settings/users',
      '/api/v1/system-settings/audit-logs',
      '/api/v1/assessments',
    ]) {
      const res = await request(server)
        .get(forbiddenUrl)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status, `STUDENT GET ${forbiddenUrl}`).toBe(403);
      assertRfc7807ProblemDetails(res.body, 403);
    }

    for (const ep of protectedEndpoints.filter((item) => item.url.includes('/assessments'))) {
      const res = await request(server)
        [ep.method](ep.url)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status, `STUDENT ${ep.method.toUpperCase()} ${ep.url}`).toBe(403);
      assertRfc7807ProblemDetails(res.body, 403);
    }

    // 3. TEACHER 4 data-state boundaries (Active FULL, Completed READ_ONLY, Replaced 403, Unassigned 403, ClassHistory 403)
    const activeTeacherRecs = await request(server)
      .get(`/api/v1/students/${studentA.id}/learning-records`)
      .set('Authorization', `Bearer ${activeTeacherToken}`)
      .expect(200);
    expect(activeTeacherRecs.body.records[0]?.accessMode).toBe('FULL');

    const completedTeacherRecs = await request(server)
      .get(`/api/v1/students/${studentBCompleted.id}/learning-records`)
      .set('Authorization', `Bearer ${completedTeacherToken}`)
      .expect(200);
    expect(completedTeacherRecs.body.records[0]?.accessMode).toBe('READ_ONLY');

    // Replaced former teacher (DEC-025 Case 2) -> 403 Forbidden
    await request(server)
      .get(`/api/v1/students/${studentA.id}/learning-records`)
      .set('Authorization', `Bearer ${replacedTeacherToken}`)
      .expect(403);

    // Unassigned teacher -> 403 Forbidden
    await request(server)
      .get(`/api/v1/students/${studentA.id}/learning-records`)
      .set('Authorization', `Bearer ${unassignedTeacherToken}`)
      .expect(403);

    // Teacher accessing cross-class history (DEC-024) -> 403 Forbidden
    await request(server)
      .get(`/api/v1/students/${studentA.id}/class-history`)
      .set('Authorization', `Bearer ${activeTeacherToken}`)
      .expect(403);

    // Teacher accessing pending enrollments or teachers list -> 403 Forbidden
    await request(server)
      .get('/api/v1/students/pending-enrollment')
      .set('Authorization', `Bearer ${activeTeacherToken}`)
      .expect(403);
    await request(server)
      .get('/api/v1/teachers')
      .set('Authorization', `Bearer ${activeTeacherToken}`)
      .expect(403);
    await request(server)
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${activeTeacherToken}`)
      .expect(200);
    await request(server)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${activeTeacherToken}`)
      .send({ code: 'HSK3', name: 'HSK 3', level: CourseLevel.HSK3 })
      .expect(403);
    await request(server)
      .post('/api/v1/classes/preview-schedule')
      .set('Authorization', `Bearer ${activeTeacherToken}`)
      .send({
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        totalSessions: 24,
      })
      .expect(403);
    await request(server)
      .post('/api/v1/classes/preview-schedule')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scheduleDays: [5, 1, 3],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-11-02',
        totalSessions: 24,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.normalizedScheduleDays).toEqual([1, 3, 5]);
        expect(body.scheduleText).toBe('T2-T4-T6 · 18:00–19:30');
        expect(body.expectedEndDate).toBe('2026-12-25');
      });

    // 4. Pure SUPERADMIN vs Dual [SUPERADMIN, ADMIN] (roles-permissions.md §2.1 & FUNC-009)
    for (const saDeniedUrl of [
      '/api/v1/students/pending-enrollment',
      '/api/v1/students/available-classes',
      '/api/v1/courses',
      '/api/v1/classes',
      `/api/v1/classes/${activeClass.id}`,
      `/api/v1/students/${studentA.id}/class-history`,
      `/api/v1/students/${studentA.id}/learning-records`,
    ]) {
      await request(server)
        .get(saDeniedUrl)
        .set('Authorization', `Bearer ${saToken}`)
        .expect(403);
    }
    await request(server)
      .post(`/api/v1/students/${studentPending.id}/assign-initial-class`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ classNameOrId: 'HSK2-A' })
      .expect(403);

    // Pure SUPERADMIN can view student identity but internalNotes is masked to null & classHistory is empty
    const saStudentView = await request(server)
      .get(`/api/v1/students/${studentA.id}`)
      .set('Authorization', `Bearer ${saToken}`)
      .expect(200);
    expect(saStudentView.body.internalNotes).toBeNull();
    expect(saStudentView.body.classHistory).toBeUndefined();

    // Pure SUPERADMIN cannot edit internalNotes (403)
    await request(server)
      .patch(`/api/v1/students/${studentA.id}`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ internalNotes: 'SA trying to write note' })
      .expect(403);

    // Dual [SUPERADMIN, ADMIN] has union permissions -> 200 on pending-enrollment, available-classes, class-history, learning-records, and assign-initial-class!
    await request(server)
      .get('/api/v1/students/pending-enrollment')
      .set('Authorization', `Bearer ${dualSaAdminToken}`)
      .expect(200);
    await request(server)
      .get('/api/v1/students/available-classes')
      .set('Authorization', `Bearer ${dualSaAdminToken}`)
      .expect(200);
    await request(server)
      .get(`/api/v1/students/${studentA.id}/class-history`)
      .set('Authorization', `Bearer ${dualSaAdminToken}`)
      .expect(200);
    await request(server)
      .get(`/api/v1/students/${studentA.id}/learning-records`)
      .set('Authorization', `Bearer ${dualSaAdminToken}`)
      .expect(200);
    await request(server)
      .post(`/api/v1/students/${studentPending.id}/assign-initial-class`)
      .set('Authorization', `Bearer ${dualSaAdminToken}`)
      .send({ classNameOrId: 'HSK2-A' })
      .expect(200);

    // 5. ADMIN cannot access SUPERADMIN-only endpoints (403)
    await request(server)
      .get('/api/v1/system-settings/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
    await request(server)
      .get('/api/v1/system-settings/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
    await request(server)
      .put('/api/v1/system-settings/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ centerName: 'Hacked Center' })
      .expect(403);

    // 6. INACTIVE status (403) & Revoked token on ACTIVE account (401)
    await request(server)
      .patch(`/api/v1/system-settings/users/${studentPending.id}/roles`)
      .set('Authorization', `Bearer ${saToken}`)
      .send({ status: UserStatus.INACTIVE })
      .expect(200);

    // INACTIVE account immediately receives 403 Forbidden in JwtAuthGuard
    const inactiveRes = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${studentPendingToken}`)
      .expect(403);
    assertRfc7807ProblemDetails(inactiveRes.body, 403);

    // Revoked token on ACTIVE account (after logout increments tokenVersion) receives 401 Unauthorized
    await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    const revokedRes = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(401);
    assertRfc7807ProblemDetails(revokedRes.body, 401);
  });

  it('Step 2B.API.3–4 & Step 3.E–F: Verifies pagination bounds, SQL wildcard & Unicode Hanzi/Pinyin safety, CORS/CSRF/Cookie flags, mass-assignment 400, and write idempotency', async () => {
    const server = harness.app.getHttpServer();
    const passwordHash = await bcrypt.hash('Password123', 10);

    await harness.prisma.user.create({
      data: {
        email: 'sa.edge@webedu.vn',
        phone: '0901000001',
        fullName: 'Superadmin Edge',
        passwordHash,
        roles: [Role.SUPERADMIN, Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    // 1. Login via Cookie and inspect Set-Cookie security flags + CORS headers
    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'sa.edge@webedu.vn', password: 'Password123' })
      .expect(200);

    expect(loginRes.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(loginRes.headers['access-control-allow-credentials']).toBe('true');

    const { cookiePair, rawSetCookie, jwtToken } = extractAuthCookie(loginRes);
    expect(rawSetCookie).toContain('HttpOnly');
    expect(rawSetCookie).toContain('SameSite=Lax');
    expect(rawSetCookie).toContain('Path=/');

    // Untrusted CORS origin must not receive Access-Control-Allow-Origin
    const untrustedCorsRes = await request(server)
      .get('/api/v1/health')
      .set('Origin', 'https://evil.example.com')
      .expect(200);
    expect(untrustedCorsRes.headers['access-control-allow-origin']).toBeUndefined();

    // CSRF Origin protection on cookie-authenticated write: untrusted Origin -> 403
    const csrfBlocked = await request(server)
      .patch('/api/v1/profile/me')
      .set('Cookie', [cookiePair])
      .set('Origin', 'https://evil.example.com')
      .send({ fullName: 'CSRF Attacker' })
      .expect(403);
    assertRfc7807ProblemDetails(csrfBlocked.body, 403);

    // 2. Mass-assignment protection (forbidNonWhitelisted: true -> 400)
    const massAssignRes = await request(server)
      .patch('/api/v1/profile/me')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ fullName: 'Valid Name', roles: ['SUPERADMIN'], tokenVersion: 999 })
      .expect(400);
    assertRfc7807ProblemDetails(massAssignRes.body, 400);

    // 3. Unicode (Hanzi, Pinyin, Vietnamese) & Idempotency of repeated writes
    const unicodePayload = {
      centerName: '天地漢語 — Trung Tâm TD Hán Ngữ (Hànyǔ Pīnyīn)',
    };
    const put1 = await request(server)
      .put('/api/v1/system-settings/config')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(unicodePayload)
      .expect(200);
    const put2 = await request(server)
      .put('/api/v1/system-settings/config')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send(unicodePayload)
      .expect(200);
    expect(put1.body.centerName).toBe(unicodePayload.centerName);
    expect(put2.body.centerName).toBe(put1.body.centerName);

    // Create teacher with Hanzi + Pinyin + Vietnamese notes, then search with SQL wildcards (%, _, \)
    const teacherRes = await request(server)
      .post('/api/v1/teachers')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        fullName: '王老师 (Wáng Lǎoshī) - Cô Vương',
        phone: '0902000002',
        email: 'wang.laoshi@webedu.vn',
        initialPassword: 'Password123',
        notes: 'Giảng viên HSK 6 — 漢語水平考試 100%_pass\\rate',
      })
      .expect(201);
    expect(teacherRes.body.fullName).toBe('王老师 (Wáng Lǎoshī) - Cô Vương');

    // Searching literal '%_\' must NOT match all teachers
    const wildcardSearch = await request(server)
      .get('/api/v1/teachers?search=%25_\\')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);
    expect(wildcardSearch.body.items).toHaveLength(0);

    // Searching by Hanzi '王老师' finds the teacher
    const hanziSearch = await request(server)
      .get(`/api/v1/teachers?search=${encodeURIComponent('王老师')}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);
    expect(hanziSearch.body.items).toHaveLength(1);

    // 4. Boundary pagination (page=0, page=-5, page=999999, limit=0, limit=-10, limit=5000) across all 5 list endpoints
    for (const listPath of [
      '/api/v1/teachers',
      '/api/v1/students',
      '/api/v1/students/pending-enrollment',
      '/api/v1/system-settings/users',
      '/api/v1/system-settings/audit-logs',
    ]) {
      const negRes = await request(server)
        .get(`${listPath}?page=-5&limit=-10`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
      expect(negRes.body.page).toBe(1);
      expect(negRes.body.limit).toBeGreaterThanOrEqual(1);

      const hugeRes = await request(server)
        .get(`${listPath}?page=999999&limit=5000`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
      expect(hugeRes.body.page).toBe(999999);
      expect(hugeRes.body.limit).toBeLessThanOrEqual(100);
      expect(hugeRes.body.items).toEqual([]);
    }
  });

  it('Step 2B.API.3 & Step 3.B–C: Verifies 404/409/413/429 RFC 7807 contracts and concurrent shared-resource operations on real PostgreSQL without deadlocks', async () => {
    const server = harness.app.getHttpServer();
    const passwordHash = await bcrypt.hash('Password123', 10);

    await harness.prisma.user.create({
      data: {
        email: 'sa.conc@webedu.vn',
        phone: '0903000001',
        fullName: 'Superadmin Concurrency',
        passwordHash,
        roles: [Role.SUPERADMIN, Role.ADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    await harness.prisma.user.create({
      data: {
        email: 'sa.backup2@webedu.vn',
        phone: '0903000002',
        fullName: 'Superadmin Backup 2',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });

    const loginRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'sa.conc@webedu.vn', password: 'Password123' })
      .expect(200);
    const { jwtToken } = extractAuthCookie(loginRes);

    // 1. 404 Not Found RFC 7807 contract
    const notFoundStudent = await request(server)
      .get('/api/v1/students/nonexistent-student-id')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(404);
    assertRfc7807ProblemDetails(notFoundStudent.body, 404);

    // 2. 413 Payload Too Large (> 4MB JSON upload on PUT /system-settings/config)
    const oversizedLogo = `data:image/png;base64,${'A'.repeat(4.5 * 1024 * 1024)}`;
    const res413 = await request(server)
      .put('/api/v1/system-settings/config')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ centerName: 'Oversized Logo Test', logoDataUri: oversizedLogo })
      .expect(413);
    assertRfc7807ProblemDetails(res413.body, 413);

    // 3. 429 Too Many Requests RFC 7807 contract on 60s forgot-password cooldown
    await request(server)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'cooldown.check@webedu.vn' })
      .expect(200);
    const res429 = await request(server)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'cooldown.check@webedu.vn' })
      .expect(429);
    assertRfc7807ProblemDetails(res429.body, 429);

    // 4. Concurrent duplicate student registrations with distinct verified emails colliding on phone (Step 3.C) -> 1x 201 Created, 3x 409 Conflict
    const concurrentEmails = Array.from(
      { length: 4 },
      (_, idx) => `race.student.${idx}@webedu.vn`,
    );
    const concurrentCodes = await Promise.all(
      concurrentEmails.map((email) =>
        obtainVerificationCodeViaHttp(harness.app, harness.smtpServer, email),
      ),
    );
    const regOutcomes = await Promise.all(
      concurrentEmails.map((email, idx) =>
        request(server)
          .post('/api/v1/auth/register')
          .send({
            fullName: `Concurrent Student ${idx}`,
            dateOfBirth: '2003-04-15',
            phone: '0904449999',
            email,
            password: 'Password123',
            verificationCode: concurrentCodes[idx],
          }),
      ),
    );
    const regStatuses = regOutcomes.map((r) => r.status);
    expect(regStatuses.filter((s) => s === 201)).toHaveLength(1);
    expect(regStatuses.filter((s) => s === 409)).toHaveLength(3);
    for (const conflictRes of regOutcomes.filter((r) => r.status === 409)) {
      assertRfc7807ProblemDetails(conflictRes.body, 409);
    }

    // 5. Concurrent initial class placement (Step 3.B & 3.C) -> at most 1 ACTIVE enrollment in DB
    const registeredStudent = await harness.prisma.user.findFirstOrThrow({
      where: { phone: '0904449999' },
    });
    const teacher = await harness.prisma.user.create({
      data: {
        email: 'teacher.race@webedu.vn',
        phone: '0903000099',
        fullName: 'Teacher Race',
        passwordHash,
        roles: [Role.TEACHER],
        status: UserStatus.ACTIVE,
      },
    });
    const course = await harness.prisma.course.create({
      data: { code: 'HSK1-RACE', name: 'HSK 1 Race', level: CourseLevel.HSK1 },
    });
    await harness.prisma.class.create({
      data: {
        code: 'CLS-RACE-01',
        status: ClassStatus.ACTIVE,
        courseId: course.id,
        teacherId: teacher.id,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const assignOutcomes = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(server)
          .post(`/api/v1/students/${registeredStudent.id}/assign-initial-class`)
          .set('Authorization', `Bearer ${jwtToken}`)
          .send({ classNameOrId: 'CLS-RACE-01' }),
      ),
    );
    const assignStatuses = assignOutcomes.map((r) => r.status);
    expect(assignStatuses.filter((s) => s === 200)).toHaveLength(1);
    expect(assignStatuses.filter((s) => s === 400 || s === 409)).toHaveLength(3);

    const activeEnrollments = await harness.prisma.enrollment.count({
      where: { studentId: registeredStudent.id, status: EnrollmentStatus.ACTIVE },
    });
    expect(activeEnrollments).toBe(1);
  });

  it('SEC-RISK-02 & SEC-RISK-03: Sets Helmet security headers and enforces 100kb global JSON limit while allowing 4mb on PUT /system-settings/config', async () => {
    const server = harness.app.getHttpServer();

    // 1. Helmet headers present on public health endpoint
    const healthRes = await request(server).get('/api/v1/health').expect(200);
    expect(healthRes.headers['x-content-type-options']).toBe('nosniff');
    expect(healthRes.headers['x-frame-options']).toBe('SAMEORIGIN');

    // 2. Oversized payload (> 100kb) on non-upload endpoint is rejected with 413
    const oversizedPayload = {
      email: 'oversized@webedu.vn',
      password: 'Password123',
      padding: 'x'.repeat(160 * 1024),
    };
    const rejectedRes = await request(server)
      .post('/api/v1/auth/login')
      .send(oversizedPayload)
      .expect(413);
    assertRfc7807ProblemDetails(rejectedRes.body, 413);

    // 3. Superadmin PUT /api/v1/system-settings/config accepts payload > 100kb (route-scoped 4mb parser)
    const passwordHash = await bcrypt.hash('Super123456', 10);
    await harness.prisma.user.create({
      data: {
        email: 'sa.payload@webedu.vn',
        phone: '0909888777',
        fullName: 'SA Payload',
        passwordHash,
        roles: [Role.SUPERADMIN],
        status: UserStatus.ACTIVE,
      },
    });
    const saLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'sa.payload@webedu.vn', password: 'Super123456' })
      .expect(200);
    const { cookiePair: saCookie } = extractAuthCookie(saLogin);
    const largeConfigRes = await request(server)
      .put('/api/v1/system-settings/config')
      .set('Cookie', [saCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        centerName: 'TD Han Ngu',
        logoDataUri: `data:image/png;base64,${'A'.repeat(180 * 1024)}`,
      });
    // Must not fail with 413 Payload Too Large (route-scoped 4mb allows parsing; validation returns 400 invalid image)
    expect(largeConfigRes.status).toBe(400);
  });
});
