import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {
  AttendanceStatus,
  ClassStatus,
  CourseLevel,
  EnrollmentStatus,
  Role,
  SessionStatus,
  UserStatus,
} from '@prisma/client';
import {
  createRealE2eAppHarness,
  extractAuthCookie,
  type RealE2eAppHarness,
} from './helpers/e2e-app-harness.js';

describe('Phase 4 HTTP E2E — Schedules, Attendance, 2-Day Window & 30% Warning', () => {
  let harness: RealE2eAppHarness;

  beforeAll(async () => {
    harness = await createRealE2eAppHarness();
  });

  afterAll(async () => {
    await harness.stop();
  });

  beforeEach(async () => {
    await harness.resetState();
  });

  async function loginAs(email: string, password: string): Promise<string> {
    const res = await request(harness.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return extractAuthCookie(res).cookiePair;
  }

  it('executes complete Phase 4 lifecycle with RBAC/BOLA enforcement, cancel/makeup renumbering, T+2 window, and 30% absence alert', async () => {
    const server = harness.app.getHttpServer();
    const passwordHash = await bcrypt.hash('Pass@12345', 10);

    const [admin, teacherLead, teacherOther, studentA, studentOther, superadmin] =
      await Promise.all([
        harness.prisma.user.create({
          data: {
            email: 'admin.p4@webedu.vn',
            phone: '0901000001',
            fullName: 'Admin Phase4',
            passwordHash,
            roles: [Role.ADMIN],
            status: UserStatus.ACTIVE,
          },
        }),
        harness.prisma.user.create({
          data: {
            email: 'teacher.lead@webedu.vn',
            phone: '0901000002',
            fullName: 'Giáo Viên Chính',
            passwordHash,
            roles: [Role.TEACHER],
            status: UserStatus.ACTIVE,
            teacherProfile: { create: { activeClassesCount: 0 } },
          },
        }),
        harness.prisma.user.create({
          data: {
            email: 'teacher.other@webedu.vn',
            phone: '0901000003',
            fullName: 'Giáo Viên Khác',
            passwordHash,
            roles: [Role.TEACHER],
            status: UserStatus.ACTIVE,
            teacherProfile: { create: { activeClassesCount: 0 } },
          },
        }),
        harness.prisma.user.create({
          data: {
            email: 'student.a@webedu.vn',
            phone: '0901000004',
            fullName: 'Học Viên A',
            passwordHash,
            roles: [Role.STUDENT],
            status: UserStatus.ACTIVE,
            studentProfile: {
              create: { dateOfBirth: new Date('2000-05-10T00:00:00.000Z') },
            },
          },
        }),
        harness.prisma.user.create({
          data: {
            email: 'student.other@webedu.vn',
            phone: '0901000005',
            fullName: 'Học Viên Ngoài Lớp',
            passwordHash,
            roles: [Role.STUDENT],
            status: UserStatus.ACTIVE,
            studentProfile: {
              create: { dateOfBirth: new Date('2000-06-15T00:00:00.000Z') },
            },
          },
        }),
        harness.prisma.user.create({
          data: {
            email: 'sa.p4@webedu.vn',
            phone: '0901000006',
            fullName: 'Superadmin P4',
            passwordHash,
            roles: [Role.SUPERADMIN],
            status: UserStatus.ACTIVE,
          },
        }),
      ]);

    const course = await harness.prisma.course.create({
      data: { code: 'HSK1-P4', name: 'Tiếng Trung HSK 1 P4', level: CourseLevel.HSK1, defaultSessions: 10 },
    });

    const [adminCookie, leadCookie, otherTeacherCookie, studentCookie, otherStudentCookie, saCookie] =
      await Promise.all([
        loginAs(admin.email, 'Pass@12345'),
        loginAs(teacherLead.email, 'Pass@12345'),
        loginAs(teacherOther.email, 'Pass@12345'),
        loginAs(studentA.email, 'Pass@12345'),
        loginAs(studentOther.email, 'Pass@12345'),
        loginAs(superadmin.email, 'Pass@12345'),
      ]);

    // 1. Admin creates class with 6 sessions starting 2026-12-02 -> auto-generates 6 REGULAR sessions
    const createRes = await request(server)
      .post('/api/v1/classes')
      .set('Cookie', [adminCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        code: 'HSK1-P4-01',
        courseId: course.id,
        teacherId: teacherLead.id,
        scheduleDays: [1, 3, 5],
        scheduleStartTime: '18:00',
        scheduleEndTime: '19:30',
        startDate: '2026-12-02',
        totalSessions: 6,
        status: ClassStatus.ACTIVE,
      })
      .expect(201);

    const classId = createRes.body.id as string;

    // Enroll studentA effective 2026-10-01 so past test sessions are eligible
    await harness.prisma.enrollment.create({
      data: {
        classId,
        studentId: studentA.id,
        status: EnrollmentStatus.ACTIVE,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    // 2. BOLA & Privacy checks on GET /classes/:id/sessions, /schedules/calendar & /attendance/me
    const sessionsRes = await request(server)
      .get(`/api/v1/classes/${classId}/sessions`)
      .set('Cookie', [leadCookie])
      .expect(200);
    expect(sessionsRes.body.sessions).toHaveLength(6);

    // Enrolled student can read class sessions (SEC-P4-03 excludes DROPPED below)
    await request(server)
      .get(`/api/v1/classes/${classId}/sessions`)
      .set('Cookie', [studentCookie])
      .expect(200);

    // Calendar window > 93 days rejected with 400 (SEC-P4-07)
    await request(server)
      .get('/api/v1/schedules/calendar?from=2026-01-01&to=2026-06-01')
      .set('Cookie', [adminCookie])
      .expect(400);

    // Dropped student has no enrollment access to class sessions (SEC-P4-03)
    await harness.prisma.enrollment.create({
      data: {
        classId,
        studentId: studentOther.id,
        status: EnrollmentStatus.DROPPED,
        enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
        leftDate: new Date('2026-10-15T00:00:00.000Z'),
      },
    });
    await request(server)
      .get(`/api/v1/classes/${classId}/sessions`)
      .set('Cookie', [otherStudentCookie])
      .expect(403);
    await harness.prisma.enrollment.deleteMany({
      where: { classId, studentId: studentOther.id },
    });

    await request(server)
      .get(`/api/v1/classes/${classId}/sessions`)
      .set('Cookie', [otherTeacherCookie])
      .expect(403);
    await request(server)
      .get(`/api/v1/classes/${classId}/sessions`)
      .set('Cookie', [otherStudentCookie])
      .expect(403);
    await request(server)
      .get(`/api/v1/classes/${classId}/sessions`)
      .set('Cookie', [saCookie])
      .expect(403);
    await request(server)
      .get(`/api/v1/attendance/me?classId=${classId}`)
      .set('Cookie', [otherStudentCookie])
      .expect(403);

    const session1Id = sessionsRes.body.sessions[0].id as string;
    const session2Id = sessionsRes.body.sessions[1].id as string;

    // 3. Teacher cannot reschedule/cancel (DEC-031); Admin rejects whitespace reason (SEC-P4-05) and can reschedule + cancel + immediate makeup
    await request(server)
      .patch(`/api/v1/sessions/${session1Id}/reschedule`)
      .set('Cookie', [adminCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        sessionDate: '2026-12-21',
        startTime: '18:00',
        endTime: '19:30',
        reason: '    ',
      })
      .expect(400);
    await request(server)
      .patch(`/api/v1/sessions/${session1Id}/reschedule`)
      .set('Cookie', [leadCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        sessionDate: '2026-12-21',
        startTime: '18:00',
        endTime: '19:30',
        reason: 'GV tự đổi',
      })
      .expect(403);

    const rescheduleRes = await request(server)
      .patch(`/api/v1/sessions/${session1Id}/reschedule`)
      .set('Cookie', [adminCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        sessionDate: '2026-12-21',
        startTime: '18:30',
        endTime: '20:00',
        reason: 'Đổi phòng học',
      })
      .expect(200);
    expect(rescheduleRes.body.session.isRescheduled).toBe(true);

    const cancelRes = await request(server)
      .post(`/api/v1/sessions/${session2Id}/cancel`)
      .set('Cookie', [adminCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        reason: 'Nghỉ lễ trung tâm',
        makeup: {
          sessionDate: '2026-12-22',
          startTime: '18:00',
          endTime: '19:30',
        },
      })
      .expect(201);
    expect(cancelRes.body.session.status).toBe(SessionStatus.CANCELLED);
    expect(cancelRes.body.session.sessionNumber).toBeNull();

    // Superadmin can read ScheduleChangeLogs (FUNC-032); Student cannot
    const logsRes = await request(server)
      .get(`/api/v1/schedules/change-logs?classId=${classId}`)
      .set('Cookie', [saCookie])
      .expect(200);
    expect(logsRes.body.items.length).toBeGreaterThanOrEqual(3);

    await request(server)
      .get('/api/v1/schedules/change-logs')
      .set('Cookie', [studentCookie])
      .expect(403);

    // 4. Create 2 past sessions (one within 2-day VN window, one expired > 2 days ago) for DEC-032 & DEC-033 check
    const todayUtc = new Date();
    const vnTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(todayUtc);
    const todayDate = new Date(`${vnTodayStr}T00:00:00.000Z`);
    const fiveDaysAgo = new Date(todayDate.getTime() - 5 * 86_400_000);

    const [recentSess, expiredSess] = await Promise.all([
      harness.prisma.lessonSession.create({
        data: {
          classId,
          sessionNumber: 7,
          sessionDate: todayDate,
          startTime: '18:00',
          endTime: '19:30',
          status: SessionStatus.SCHEDULED,
        },
      }),
      harness.prisma.lessonSession.create({
        data: {
          classId,
          sessionNumber: 8,
          sessionDate: fiveDaysAgo,
          startTime: '18:00',
          endTime: '19:30',
          status: SessionStatus.SCHEDULED,
        },
      }),
    ]);

    // Teacher marks recent session as ABSENT -> session transitions to COMPLETED
    const markRecentRes = await request(server)
      .put(`/api/v1/sessions/${recentSess.id}/attendance`)
      .set('Cookie', [leadCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        records: [{ studentId: studentA.id, status: AttendanceStatus.ABSENT }],
      })
      .expect(200);
    expect(markRecentRes.body.session.status).toBe(SessionStatus.COMPLETED);

    // Completed session exposes attendanceSummary to Lead Teacher/Admin, but MUST mask to null for Student (SEC-P4-03)
    const teacherDetailRes = await request(server)
      .get(`/api/v1/sessions/${recentSess.id}`)
      .set('Cookie', [leadCookie])
      .expect(200);
    expect(teacherDetailRes.body.attendanceSummary).toMatchObject({
      absentCount: 1,
      totalMarkedCount: 1,
    });
    const studentDetailRes = await request(server)
      .get(`/api/v1/sessions/${recentSess.id}`)
      .set('Cookie', [studentCookie])
      .expect(200);
    expect(studentDetailRes.body.attendanceSummary).toBeNull();

    // Teacher edits expired session AFTER marking it first -> blocked after T+2 (403); Admin overrides cleanly with AuditLog!
    await request(server)
      .put(`/api/v1/sessions/${expiredSess.id}/attendance`)
      .set('Cookie', [leadCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        records: [{ studentId: studentA.id, status: AttendanceStatus.ABSENT }],
      })
      .expect(200);

    await request(server)
      .put(`/api/v1/sessions/${expiredSess.id}/attendance`)
      .set('Cookie', [leadCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        reason: 'GV thử sửa sau hạn 2 ngày',
        records: [{ studentId: studentA.id, status: AttendanceStatus.PRESENT }],
      })
      .expect(403);

    const overrideRes = await request(server)
      .put(`/api/v1/sessions/${expiredSess.id}/attendance`)
      .set('Cookie', [adminCookie])
      .set('Origin', 'http://localhost:3000')
      .send({
        reason: 'Admin sửa thay do quá hạn T+2',
        records: [{ studentId: studentA.id, status: AttendanceStatus.EXCUSED, note: 'Đơn phép hợp lệ' }],
      })
      .expect(200);
    expect(overrideRes.body.session.isMarked).toBe(true);
    expect(overrideRes.body.auditLogs).toHaveLength(1);
    expect(overrideRes.body.auditLogs[0].isAdminOverride).toBe(true);
    expect(overrideRes.body.auditLogs[0].previousStatus).toBe(AttendanceStatus.ABSENT);
    expect(overrideRes.body.auditLogs[0].newStatus).toBe(AttendanceStatus.EXCUSED);

    // 5. Verify DEC-033 30% warning on /attendance/matrix & /attendance/me:
    // totalSessions = 6 -> 1 ABSENT + 1 EXCUSED = 2 absences -> 2 * 100 = 200 >= 6 * 30 = 180 -> isAt30PercentWarning = true!
    const matrixRes = await request(server)
      .get(`/api/v1/classes/${classId}/attendance/matrix`)
      .set('Cookie', [leadCookie])
      .expect(200);
    const stuMetrics = matrixRes.body.students[0].metrics;
    expect(stuMetrics.absentCount).toBe(1);
    expect(stuMetrics.excusedCount).toBe(1);
    expect(stuMetrics.totalAbsenceCount).toBe(2);
    expect(stuMetrics.isAt30PercentWarning).toBe(true);

    const myAttRes = await request(server)
      .get(`/api/v1/attendance/me?classId=${classId}`)
      .set('Cookie', [studentCookie])
      .expect(200);
    expect(myAttRes.body.metrics.totalAbsenceCount).toBe(2);
    expect(myAttRes.body.metrics.isAt30PercentWarning).toBe(true);
  });
});
