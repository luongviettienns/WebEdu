import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { SessionAttendanceSheetDto } from '../attendance.types.js';
import type { SaveSessionAttendanceDto } from '../dto/attendance.dto.js';
import { AttendancePolicy } from '../policies/attendance.policy.js';
import { AttendanceQueryService } from './attendance-query.service.js';

@Injectable()
export class AttendanceCrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: AttendancePolicy,
    private readonly queryService: AttendanceQueryService,
  ) {}

  async saveSessionAttendance(
    actor: AuthenticatedUser,
    sessionId: string,
    dto: SaveSessionAttendanceDto,
  ): Promise<SessionAttendanceSheetDto> {
    const now = new Date();
    const trimmedReason = dto.reason?.trim() || '';

    await this.prisma.$transaction(async (tx) => {
      const targetMeta = await tx.lessonSession.findUnique({
        where: { id: sessionId },
        select: { id: true, classId: true },
      });
      if (!targetMeta) throw new NotFoundException('Không tìm thấy buổi học');

      await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${targetMeta.classId} FOR UPDATE`;

      const session = await tx.lessonSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: {
          class: { select: { id: true, teacherId: true, status: true } },
          attendanceRecords: true,
        },
      });

      const hasExistingAttendance =
        session.status === SessionStatus.COMPLETED || session.attendanceRecords.length > 0;

      const auth = this.policy.resolveSaveAuthorization(
        actor,
        session.class,
        { status: session.status, sessionDate: session.sessionDate },
        hasExistingAttendance,
        now,
      );

      const eligibleEnrollments = await tx.enrollment.findMany({
        where: {
          classId: session.classId,
          enrolledDate: { lte: session.sessionDate },
          OR: [{ leftDate: null }, { leftDate: { gte: session.sessionDate } }],
        },
        select: { studentId: true },
      });

      if (eligibleEnrollments.length === 0) {
        throw new BadRequestException(
          'Lớp chưa có học viên nào theo học tại ngày diễn ra buổi học này',
        );
      }

      const eligibleSet = new Set(eligibleEnrollments.map((e) => e.studentId));
      const seenSubmitted = new Set<string>();
      for (const entry of dto.records) {
        if (seenSubmitted.has(entry.studentId)) {
          throw new BadRequestException('Danh sách điểm danh có học viên bị trùng lặp');
        }
        if (!eligibleSet.has(entry.studentId)) {
          throw new BadRequestException(
            'Danh sách điểm danh chứa học viên không thuộc lớp tại ngày diễn ra buổi học',
          );
        }
        seenSubmitted.add(entry.studentId);
      }

      if (seenSubmitted.size !== eligibleSet.size) {
        throw new BadRequestException(
          'Vui lòng điểm danh đầy đủ 100% học viên thuộc lớp tại buổi học này',
        );
      }

      const existingMap = new Map(session.attendanceRecords.map((r) => [r.studentId, r]));

      // Fail-fast pre-check: require reason before issuing any UPDATE when modifying saved attendance.
      for (const entry of dto.records) {
        const nextNote = entry.note?.trim() || null;
        const existing = existingMap.get(entry.studentId);
        if (existing && (existing.status !== entry.status || (existing.note ?? null) !== nextNote) && !trimmedReason) {
          throw new BadRequestException('Vui lòng nhập lý do khi sửa kết quả điểm danh đã lưu');
        }
      }

      const auditEntries: Array<{
        attendanceRecordId: string;
        sessionId: string;
        studentId: string;
        previousStatus: AttendanceStatus;
        newStatus: AttendanceStatus;
        previousNote: string | null;
        newNote: string | null;
        reason: string;
        actorId: string;
        actorRole: typeof auth.actorRole;
        isAdminOverride: boolean;
      }> = [];

      for (const entry of dto.records) {
        const nextNote = entry.note?.trim() || null;
        const existing = existingMap.get(entry.studentId);
        if (!existing) {
          await tx.attendanceRecord.create({
            data: {
              sessionId,
              classId: session.classId,
              studentId: entry.studentId,
              status: entry.status,
              note: nextNote,
              markedById: actor.id,
              markedAt: now,
            },
          });
          continue;
        }

        const previousStatus = existing.status;
        const previousNote = existing.note;
        const changed = previousStatus !== entry.status || (previousNote ?? null) !== nextNote;
        if (!changed) continue;

        await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: entry.status,
            note: nextNote,
            updatedById: actor.id,
          },
        });

        auditEntries.push({
          attendanceRecordId: existing.id,
          sessionId,
          studentId: entry.studentId,
          previousStatus,
          newStatus: entry.status,
          previousNote,
          newNote: nextNote,
          reason: trimmedReason,
          actorId: actor.id,
          actorRole: auth.actorRole,
          isAdminOverride: auth.isAdminOverride,
        });
      }

      if (auditEntries.length > 0) {
        await tx.attendanceAuditLog.createMany({ data: auditEntries });
      }

      await tx.lessonSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.COMPLETED,
          attendanceMarkedById: session.attendanceMarkedById ?? actor.id,
          attendanceMarkedAt: session.attendanceMarkedAt ?? now,
        },
      });
    });

    return this.queryService.getSessionAttendanceSheet(actor, sessionId);
  }
}
