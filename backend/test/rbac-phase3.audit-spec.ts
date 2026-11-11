import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ClassStatus, CourseLevel, EnrollmentStatus, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';

describe('Phase 3 RBAC audit against disposable PostgreSQL', () => {
  let harness: RealE2eAppHarness;
  let passwordHash: string;
  const password = 'AuditTestPassword@123';
  const enrollmentDate = new Date('2026-10-01');
  const api = () => request(harness.app.getHttpServer());

  async function login(id: string): Promise<string> {
    const result = await api().post('/api/v1/auth/login')
      .send({ email: id + '@audit.test', password }).expect(200);
    return 'Bearer ' + extractAuthCookie(result).jwtToken;
  }

  function patchRoles(authorization: string, id: string, changes: object) {
    return api().patch('/api/v1/system-settings/users/' + id + '/roles')
      .set('Authorization', authorization).send(changes);
  }

  function loadUser(id: string) {
    return harness.prisma.user.findUniqueOrThrow({
      where: { id },
      include: { studentProfile: true },
    });
  }

  async function waitForBlockedUserLock() {
    await expect.poll(async () => {
      const rows = await harness.prisma.$queryRaw<{ blocked: number }[]>
        `SELECT count(*)::int AS blocked FROM pg_stat_activity
          WHERE datname = current_database()
            AND cardinality(pg_blocking_pids(pid)) > 0
            AND query LIKE '%FOR UPDATE%'`;
      return rows[0]?.blocked;
    }, { timeout: 3500, interval: 25 }).toBeGreaterThan(0);
  }

  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL) {
      throw new Error('Clear TEST_DATABASE_URL and DATABASE_URL before running the RBAC audit');
    }
    harness = await createRealE2eAppHarness();
    await harness.app.listen(0, '127.0.0.1');
    passwordHash = await bcrypt.hash(password, 4);
  });

  afterAll(async () => {
    await harness?.stop();
  });

  beforeEach(async () => {
    await harness.resetState();
    const accounts = [
      { id: 's1', roles: [Role.SUPERADMIN] },
      { id: 's2', roles: [Role.SUPERADMIN] },
      { id: 'admin', roles: [Role.ADMIN] },
      { id: 'teacher', roles: [Role.TEACHER] },
      { id: 'student', roles: [Role.STUDENT] },
      { id: 'multi', roles: [Role.ADMIN, Role.TEACHER] },
    ];
    await harness.prisma.user.createMany({
      data: accounts.map(({ id, roles }, index) => ({
        id, roles, email: id + '@audit.test', phone: '091888880' + index,
        fullName: 'Audit ' + id, passwordHash, status: UserStatus.ACTIVE,
      })),
    });
  });

  async function placeStudent(status: ClassStatus, enrollmentStatus: EnrollmentStatus) {
    await harness.prisma.course.create({
      data: { id: 'course', code: 'HSK1', name: 'HSK1', level: CourseLevel.HSK1 },
    });
    await harness.prisma.class.create({
      data: {
        id: 'class', code: 'HSK1-AUDIT', status, courseId: 'course',
        teacherId: 'teacher', startDate: enrollmentDate,
      },
    });
    await harness.prisma.studentProfile.create({
      data: {
        userId: 'student', dateOfBirth: new Date('2002-01-01'),
        currentClassId: 'class', assignedClass: 'HSK1-AUDIT', enrolledAt: enrollmentDate,
      },
    });
    await harness.prisma.enrollment.create({
      data: {
        classId: 'class', studentId: 'student',
        status: enrollmentStatus, enrolledDate: enrollmentDate,
      },
    });
  }

  it.each(['teacher', 'student'])('rejects Admin editing a concurrently promoted %s', async (id) => {
    const admin = await login('admin');
    const endpoint = id === 'teacher' ? '/api/v1/teachers/' : '/api/v1/students/';
    const original = await loadUser(id);
    let pending: Promise<{ status: number }> | undefined;
    await harness.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { roles: [...original.roles, Role.SUPERADMIN], tokenVersion: { increment: 1 } },
      });
      pending = api().patch(endpoint + id).set('Authorization', admin)
        .send({ email: id + '-replacement@audit.test' }).then(({ status }) => ({ status }));
      await waitForBlockedUserLock();
    }, { timeout: 8000 });

    const response = await pending;
    const { email, roles } = await loadUser(id);
    expect(roles).toContain(Role.SUPERADMIN);
    expect({ response, email }).toEqual({
      response: { status: 403 }, email: original.email,
    });
  });

  it('blocks a role grant already in flight when the acting Superadmin is demoted', async () => {
    const [first, second] = await Promise.all([login('s1'), login('s2')]);
    let pending: Promise<{ status: number }> | undefined;
    await harness.prisma.$transaction(async (tx) => {
      // The target sorts before s1 and s2 in the canonical lock order.
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = 'admin' FOR UPDATE`;
      pending = patchRoles(second, 'admin', { roles: [Role.ADMIN, Role.SUPERADMIN] })
        .then(({ status }) => ({ status }));
      await waitForBlockedUserLock();
      await patchRoles(first, 's2', { roles: [Role.ADMIN] }).expect(200);
    }, { timeout: 8000 });

    const response = await pending;
    expect({
      denied: response?.status === 401 || response?.status === 403,
      roles: (await loadUser('admin')).roles,
    }).toEqual({ denied: true, roles: [Role.ADMIN] });
  });

  it('prevents a stale second status form from restoring a removed Admin role', async () => {
    const [first, second] = await Promise.all([login('s1'), login('s2')]);
    const before = await loadUser('multi');
    await patchRoles(first, 'multi', { roles: [Role.TEACHER] }).expect(200);
    // This matches the current UI, which submits both fields even for a status-only edit.
    await patchRoles(second, 'multi', {
      roles: before.roles, status: UserStatus.INACTIVE,
    });
    expect((await loadUser('multi')).roles).toEqual([Role.TEACHER]);
  });

  it('preserves account isolation when revoking multiple sessions of the same user', async () => {
    const [superadmin, first, second, separate] = await Promise.all([
      login('s1'), login('multi'), login('multi'), login('teacher'),
    ]);
    await patchRoles(superadmin, 'multi', { roles: [Role.TEACHER] }).expect(200);

    for (const authorization of [first, second]) {
      await api().get('/api/v1/auth/me').set('Authorization', authorization).expect(401);
    }
    await api().get('/api/v1/auth/me').set('Authorization', separate).expect(200);
    const refreshed = await api().get('/api/v1/auth/me')
      .set('Authorization', await login('multi')).expect(200);
    expect(refreshed.body.roles).toEqual([Role.TEACHER]);
  });

  it('preserves the student profile invariant when adding STUDENT to a staff account', async () => {
    await patchRoles(await login('s1'), 'teacher', { roles: [Role.TEACHER, Role.STUDENT] });
    const account = await loadUser('teacher');
    expect(account.roles.includes(Role.STUDENT) && account.studentProfile === null).toBe(false);
  });

  it('preserves the role-to-enrollment invariant when removing STUDENT', async () => {
    await placeStudent(ClassStatus.ACTIVE, EnrollmentStatus.ACTIVE);
    await patchRoles(await login('s1'), 'student', { roles: [Role.TEACHER] });
    const account = await loadUser('student');
    const activeEnrollments = await harness.prisma.enrollment.count({
      where: { studentId: account.id, status: EnrollmentStatus.ACTIVE },
    });
    expect(account.roles.includes(Role.STUDENT) || activeEnrollments === 0).toBe(true);
  });

  it('retains READ_ONLY learning records after a class is archived (DEC-025)', async () => {
    await placeStudent(ClassStatus.COMPLETED, EnrollmentStatus.COMPLETED);
    const teacher = await login('teacher');
    const url = '/api/v1/students/student/learning-records';
    const completed = await api().get(url).set('Authorization', teacher).expect(200);
    expect(completed.body.records[0]?.accessMode).toBe('READ_ONLY');

    await harness.prisma.class.update({ where: { id: 'class' }, data: { status: ClassStatus.ARCHIVED } });
    const archived = await api().get(url).set('Authorization', teacher);
    expect({ status: archived.status, scope: archived.body.records?.[0]?.accessMode })
      .toEqual({ status: 200, scope: 'READ_ONLY' });
  });

  it('keeps current class data out of pure Superadmin identity responses', async () => {
    await placeStudent(ClassStatus.ACTIVE, EnrollmentStatus.ACTIVE);
    const superadmin = await login('s1');
    const detail = await api().get('/api/v1/students/student').set('Authorization', superadmin).expect(200);
    const list = await api().get('/api/v1/students').set('Authorization', superadmin).expect(200);
    expect([
      detail.body.currentClassId ?? null,
      detail.body.assignedClass ?? null,
      list.body.items[0]?.assignedClass ?? null,
    ]).toEqual([null, null, null]);
  });
});
