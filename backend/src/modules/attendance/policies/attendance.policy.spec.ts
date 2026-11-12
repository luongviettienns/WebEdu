import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, ClassStatus, Role, SessionStatus, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { AttendancePolicy } from './attendance.policy.js';

function actor(id: string, roles: Role[]): AuthenticatedUser {
  return {
    id,
    email: `${id}@webedu.vn`,
    phone: '0900000001',
    fullName: id,
    roles,
    effectiveRole: roles[0]!,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };
}

describe('AttendancePolicy (DEC-032 & DEC-033 TDD)', () => {
  const policy = new AttendancePolicy();

  it('implements DEC-033 30% warning formula: (absent + excused) * 100 >= totalSessions * 30', () => {
    // Class totalSessions = 24 -> 30% = 7.2 -> 7 absences = 29.17% (false), 8 absences = 33.33% (true)
    const sevenAbsences = [
      ...Array.from({ length: 10 }, () => ({ status: AttendanceStatus.PRESENT })),
      ...Array.from({ length: 4 }, () => ({ status: AttendanceStatus.ABSENT })),
      ...Array.from({ length: 3 }, () => ({ status: AttendanceStatus.EXCUSED })),
    ];
    const m7 = policy.computeStudentMetrics(sevenAbsences, 24);
    expect(m7.absentCount).toBe(4);
    expect(m7.excusedCount).toBe(3);
    expect(m7.totalAbsenceCount).toBe(7);
    expect(m7.isAt30PercentWarning).toBe(false);
    expect(m7.attendanceRatePercent).toBe(Math.round((10 / 17) * 100));

    const eightAbsences = [...sevenAbsences, { status: AttendanceStatus.EXCUSED }];
    const m8 = policy.computeStudentMetrics(eightAbsences, 24);
    expect(m8.totalAbsenceCount).toBe(8);
    expect(m8.isAt30PercentWarning).toBe(true);

    // Exact 30% boundary: 3/10 = 30.0% -> triggers warning (>= 30%)
    const mExact30 = policy.computeStudentMetrics(
      [
        ...Array.from({ length: 7 }, () => ({ status: AttendanceStatus.PRESENT })),
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.EXCUSED },
      ],
      10,
    );
    expect(mExact30.isAt30PercentWarning).toBe(true);

    // Zero marked sessions -> null rate (no fake 100% or 0%)
    const mEmpty = policy.computeStudentMetrics([], 24);
    expect(mEmpty.attendanceRatePercent).toBeNull();
    expect(mEmpty.isAt30PercentWarning).toBe(false);
  });

  it('enforces DEC-032 2-day GMT+7 edit deadline for Teacher while allowing Admin override anytime', () => {
    const lessonDate = new Date('2026-11-10T00:00:00.000Z');
    const teacher = actor('t-1', [Role.TEACHER]);
    const otherTeacher = actor('t-2', [Role.TEACHER]);
    const admin = actor('a-1', [Role.ADMIN]);
    const cls = { teacherId: 't-1', status: ClassStatus.ACTIVE };

    // 2026-11-12 23:59:59.000 GMT+7 == 2026-11-12T16:59:59.000Z (WITHIN 2-day window)
    const within = new Date('2026-11-12T16:59:59.000Z');
    const resWithin = policy.resolveSaveAuthorization(
      teacher,
      cls,
      { status: SessionStatus.COMPLETED, sessionDate: lessonDate },
      true,
      within,
    );
    expect(resWithin.actorRole).toBe(Role.TEACHER);
    expect(resWithin.isAdminOverride).toBe(false);

    // 2026-11-13 00:00:00.000 GMT+7 == 2026-11-12T17:00:00.000Z (EXPIRED)
    const expired = new Date('2026-11-12T17:00:00.000Z');
    expect(() =>
      policy.resolveSaveAuthorization(
        teacher,
        cls,
        { status: SessionStatus.COMPLETED, sessionDate: lessonDate },
        true,
        expired,
      ),
    ).toThrow(ForbiddenException);

    // Non-lead teacher cannot access
    expect(() =>
      policy.resolveSaveAuthorization(
        otherTeacher,
        cls,
        { status: SessionStatus.SCHEDULED, sessionDate: lessonDate },
        false,
        within,
      ),
    ).toThrow(ForbiddenException);

    // Admin override after expiry succeeds with isAdminOverride = true
    const adminRes = policy.resolveSaveAuthorization(
      admin,
      cls,
      { status: SessionStatus.COMPLETED, sessionDate: lessonDate },
      true,
      expired,
    );
    expect(adminRes.actorRole).toBe(Role.ADMIN);
    expect(adminRes.isAdminOverride).toBe(true);
  });

  it('rejects attendance on CANCELLED or future VN date sessions', () => {
    const admin = actor('a-1', [Role.ADMIN]);
    const cls = { teacherId: 't-1', status: ClassStatus.ACTIVE };
    const now = new Date('2026-11-10T10:00:00.000Z');

    expect(() =>
      policy.resolveSaveAuthorization(
        admin,
        cls,
        { status: SessionStatus.CANCELLED, sessionDate: new Date('2026-11-10T00:00:00.000Z') },
        false,
        now,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      policy.resolveSaveAuthorization(
        admin,
        cls,
        { status: SessionStatus.SCHEDULED, sessionDate: new Date('2026-11-11T00:00:00.000Z') },
        false,
        now,
      ),
    ).toThrow(BadRequestException);
  });
});
