import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AttendanceStatus, ClassStatus, Role, SessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import {
  calculateTeacherAttendanceDeadline,
  formatDateTimeVn,
  isVnFutureDate,
  isWithinTeacherAttendanceWindow,
} from '../../../common/utils/timezone.util.js';
import type { StudentAttendanceMetricsDto } from '../attendance.types.js';

@Injectable()
export class AttendancePolicy {
  /**
   * Computes student attendance metrics in a class per `DEC-033` (`ATT-01a`) & `05-diem-danh.md`:
   * - Separates `absentCount` (`ABSENT`) and `excusedCount` (`EXCUSED`) for UI columns.
   * - `isAt30PercentWarning`: integer cross-multiplication `(absentCount + excusedCount) * 100 >= totalSessions * 30`.
   * - `attendanceRatePercent`: `Math.round((presentCount / markedSessionsCount) * 100)` or `null` when unmarked.
   */
  computeStudentMetrics(
    records: ReadonlyArray<{ status: AttendanceStatus }>,
    classTotalSessions: number,
  ): StudentAttendanceMetricsDto {
    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;

    for (const r of records) {
      if (r.status === AttendanceStatus.PRESENT) presentCount += 1;
      else if (r.status === AttendanceStatus.ABSENT) absentCount += 1;
      else if (r.status === AttendanceStatus.EXCUSED) excusedCount += 1;
    }

    const totalAbsenceCount = absentCount + excusedCount;
    const markedSessionsCount = records.length;
    const attendanceRatePercent =
      markedSessionsCount > 0 ? Math.round((presentCount / markedSessionsCount) * 100) : null;
    const absenceRateOfTotalPercent =
      classTotalSessions > 0
        ? Number(((totalAbsenceCount / classTotalSessions) * 100).toFixed(1))
        : 0;
    const isAt30PercentWarning =
      classTotalSessions > 0 && totalAbsenceCount * 100 >= classTotalSessions * 30;

    return {
      presentCount,
      absentCount,
      excusedCount,
      totalAbsenceCount,
      markedSessionsCount,
      attendanceRatePercent,
      absenceRateOfTotalPercent,
      isAt30PercentWarning,
    };
  }

  isStudentEligibleForSessionDate(
    enrollment: { enrolledDate: Date; leftDate: Date | null },
    sessionDate: Date,
  ): boolean {
    const sTime = sessionDate.getTime();
    if (enrollment.enrolledDate.getTime() > sTime) return false;
    if (enrollment.leftDate !== null && enrollment.leftDate.getTime() < sTime) return false;
    return true;
  }

  assertCanReadClassAttendance(
    actor: AuthenticatedUser,
    cls: { teacherId: string },
  ): 'ADMIN' | 'TEACHER' {
    if (actor.roles.includes(Role.ADMIN)) return 'ADMIN';
    if (actor.roles.includes(Role.TEACHER) && cls.teacherId === actor.id) return 'TEACHER';
    throw new ForbiddenException('Bạn không có quyền xem dữ liệu điểm danh của lớp học này');
  }

  /**
   * Enforces `DEC-026`, `DEC-030`, `DEC-032` for saving/editing session attendance.
   * Returns whether this mutation counts as a post-deadline Admin override.
   */
  resolveSaveAuthorization(
    actor: AuthenticatedUser,
    cls: { teacherId: string; status: ClassStatus },
    session: { status: SessionStatus; sessionDate: Date },
    hasExistingAttendance: boolean,
    nowInstant: Date = new Date(),
  ): { actorRole: Role; isAdminOverride: boolean; isWithinTeacherWindow: boolean; deadlineVnText: string } {
    const isAdmin = actor.roles.includes(Role.ADMIN);
    const isLeadTeacher = actor.roles.includes(Role.TEACHER) && cls.teacherId === actor.id;

    if (!isAdmin && !isLeadTeacher) {
      throw new ForbiddenException('Bạn không có quyền điểm danh lớp học này');
    }

    if (cls.status === ClassStatus.COMPLETED || cls.status === ClassStatus.ARCHIVED) {
      throw new ForbiddenException('Lớp học đã kết thúc hoặc lưu trữ (chỉ đọc), không thể điểm danh');
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('Không thể điểm danh cho buổi học đã hủy');
    }

    if (isVnFutureDate(session.sessionDate, nowInstant)) {
      throw new BadRequestException('Chưa đến ngày diễn ra buổi học, chưa thể điểm danh buổi tương lai');
    }

    const withinWindow = isWithinTeacherAttendanceWindow(session.sessionDate, nowInstant);
    const deadlineVnText = formatDateTimeVn(calculateTeacherAttendanceDeadline(session.sessionDate));

    if (!isAdmin && hasExistingAttendance && !withinWindow) {
      throw new ForbiddenException(
        `Đã quá hạn sửa điểm danh của giáo viên (${deadlineVnText} GMT+7). Vui lòng liên hệ Admin để điều chỉnh.`,
      );
    }

    return {
      actorRole: isAdmin ? Role.ADMIN : Role.TEACHER,
      isAdminOverride: isAdmin && hasExistingAttendance && !withinWindow,
      isWithinTeacherWindow: withinWindow,
      deadlineVnText,
    };
  }
}
