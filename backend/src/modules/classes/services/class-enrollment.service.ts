import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-error.util.js';
import { resolveVnCalendarDateForDb } from '../../../common/utils/timezone.util.js';
import { assertActorMayModifyAccount } from '../../../common/auth/superadmin-protection.policy.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { assertEffectiveDateNotInFuture } from '../policies/class-schedule.util.js';
import type { DropStudentClassDto, EnrollStudentsDto, TransferStudentClassDto } from '../dto/classes.dto.js';

@Injectable()
export class ClassEnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  async enrollStudents(
    actor: AuthenticatedUser,
    classId: string,
    dto: EnrollStudentsDto,
  ): Promise<{ enrolledCount: number; classId: string; classCode: string; studentIds: string[] }> {
    const uniqueIds = Array.from(new Set((dto.studentIds ?? []).map((id) => id.trim()).filter(Boolean)));
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Danh sách học viên cần thêm vào lớp không được để trống');
    }

    const enrolledDate = resolveVnCalendarDateForDb(dto.enrolledDate);
    if (!enrolledDate) throw new BadRequestException('Ngày vào lớp không hợp lệ');
    assertEffectiveDateNotInFuture(enrolledDate, 'Ngày vào lớp');

    const sortedIds = [...uniqueIds].sort((a, b) => a.localeCompare(b));

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${classId} FOR UPDATE`;

        const targetClass = await tx.class.findUnique({ where: { id: classId } });
        if (!targetClass) throw new NotFoundException('Không tìm thấy lớp học');
        if (targetClass.status !== ClassStatus.UPCOMING && targetClass.status !== ClassStatus.ACTIVE) {
          throw new BadRequestException(
            'Chỉ có thể thêm học viên vào lớp Sắp mở (UPCOMING) hoặc Đang học (ACTIVE)',
          );
        }

        for (const sid of sortedIds) {
          await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${sid} FOR UPDATE`;
        }

        const users = await tx.user.findMany({
          where: { id: { in: sortedIds } },
          include: { studentProfile: true },
        });
        if (users.length !== sortedIds.length || users.some((u) => !u.roles.includes(Role.STUDENT))) {
          throw new NotFoundException('Một hoặc nhiều học viên không tồn tại trong hệ thống');
        }

        const userMap = new Map(users.map((u) => [u.id, u]));
        for (const sid of sortedIds) {
          const user = userMap.get(sid)!;
          assertActorMayModifyAccount(actor, user.roles);
          if (user.status === UserStatus.INACTIVE) {
            throw new BadRequestException(
              `Học viên ${user.fullName} đang ở trạng thái Vô hiệu hóa, không thể thêm vào lớp`,
            );
          }
        }

        const existingActive = await tx.enrollment.findMany({
          where: { studentId: { in: sortedIds }, status: EnrollmentStatus.ACTIVE },
          include: { class: { select: { code: true } } },
        });
        if (existingActive.length > 0) {
          throw new ConflictException(
            `Học viên đã có lớp học đang hoạt động (${existingActive[0]!.class.code}). Mỗi học viên chỉ được học 1 lớp tại một thời điểm`,
          );
        }

        for (const studentId of sortedIds) {
          const user = userMap.get(studentId)!;
          await tx.enrollment.create({
            data: { classId: targetClass.id, studentId, status: EnrollmentStatus.ACTIVE, enrolledDate },
          });
          await tx.user.update({ where: { id: studentId }, data: { status: UserStatus.ACTIVE } });
          if (user.studentProfile) {
            await tx.studentProfile.update({
              where: { userId: studentId },
              data: { assignedClass: targetClass.code, currentClassId: targetClass.id, enrolledAt: enrolledDate },
            });
          }
        }

        await writeAuditLog(tx, actor, {
          action: 'CLASS_STUDENTS_ENROLLED',
          targetType: 'Class',
          targetId: targetClass.id,
          metadata: {
            classCode: targetClass.code,
            studentIds: sortedIds,
            enrolledCount: sortedIds.length,
            enrolledDate: enrolledDate.toISOString(),
          },
        });

        return {
          enrolledCount: sortedIds.length,
          classId: targetClass.id,
          classCode: targetClass.code,
          studentIds: sortedIds,
        };
      });
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException(
          'Học viên đã có lớp học đang hoạt động bởi một yêu cầu đồng thời khác',
        );
      }
      throw err;
    }
  }

  async transferStudent(
    actor: AuthenticatedUser,
    sourceClassId: string,
    studentId: string,
    dto: TransferStudentClassDto,
  ): Promise<{
    status: 'TRANSFERRED';
    sourceClassId: string;
    targetClassId: string;
    targetClassCode: string;
    studentId: string;
  }> {
    const targetClassId = (dto.targetClassId ?? '').trim();
    if (!targetClassId || targetClassId === sourceClassId.trim()) {
      throw new BadRequestException('Lớp chuyển đến phải khác lớp hiện tại');
    }

    const transferDate = resolveVnCalendarDateForDb(dto.transferDate);
    if (!transferDate) throw new BadRequestException('Ngày chuyển lớp không hợp lệ');
    assertEffectiveDateNotInFuture(transferDate, 'Ngày chuyển lớp');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sortedClassIds = [sourceClassId, targetClassId].sort((a, b) =>
          a.localeCompare(b),
        );
        for (const cid of sortedClassIds) {
          await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${cid} FOR UPDATE`;
        }

        const [sourceClass, targetClass] = await Promise.all([
          tx.class.findUnique({ where: { id: sourceClassId } }),
          tx.class.findUnique({ where: { id: targetClassId } }),
        ]);
        if (!sourceClass || !targetClass) throw new NotFoundException('Không tìm thấy lớp học');
        if (sourceClass.status === ClassStatus.COMPLETED || sourceClass.status === ClassStatus.ARCHIVED) {
          throw new BadRequestException('Không thể chuyển học viên từ lớp đã kết thúc hoặc lưu trữ');
        }
        if (targetClass.status !== ClassStatus.UPCOMING && targetClass.status !== ClassStatus.ACTIVE) {
          throw new BadRequestException('Chỉ có thể chuyển học viên sang lớp Sắp mở hoặc Đang học');
        }

        const student = await this.lockAndVerifyStudent(tx, actor, studentId);
        if (student.status === UserStatus.INACTIVE) {
          throw new BadRequestException(
            `Học viên ${student.fullName} đang ở trạng thái Vô hiệu hóa, không thể chuyển lớp`,
          );
        }

        const activeEnrollment = await tx.enrollment.findFirst({
          where: { classId: sourceClassId, studentId, status: EnrollmentStatus.ACTIVE },
        });
        if (!activeEnrollment) {
          throw new BadRequestException('Học viên hiện không ở trạng thái đang học trong lớp nguồn này');
        }
        if (transferDate.getTime() < activeEnrollment.enrolledDate.getTime()) {
          throw new BadRequestException('Ngày chuyển lớp không được nhỏ hơn ngày vào lớp ban đầu');
        }

        const trimmedReason = dto.reason?.trim() || null;

        await tx.enrollment.update({
          where: { id: activeEnrollment.id },
          data: {
            status: EnrollmentStatus.TRANSFERRED,
            leftDate: transferDate,
            reason: trimmedReason || `Chuyển sang lớp ${targetClass.code}`,
          },
        });

        await tx.enrollment.create({
          data: {
            classId: targetClass.id,
            studentId,
            status: EnrollmentStatus.ACTIVE,
            enrolledDate: transferDate,
            reason: trimmedReason || `Chuyển từ lớp ${sourceClass.code}`,
          },
        });

        await tx.user.update({ where: { id: studentId }, data: { status: UserStatus.ACTIVE } });
        if (student.studentProfile) {
          await tx.studentProfile.update({
            where: { userId: studentId },
            data: { assignedClass: targetClass.code, currentClassId: targetClass.id, enrolledAt: transferDate },
          });
        }

        await writeAuditLog(tx, actor, {
          action: 'CLASS_STUDENT_TRANSFERRED',
          targetType: 'User',
          targetId: studentId,
          metadata: {
            sourceClassId,
            sourceClassCode: sourceClass.code,
            targetClassId: targetClass.id,
            targetClassCode: targetClass.code,
            transferDate: transferDate.toISOString(),
            reason: trimmedReason,
          },
        });

        return {
          status: 'TRANSFERRED' as const,
          sourceClassId,
          targetClassId: targetClass.id,
          targetClassCode: targetClass.code,
          studentId,
        };
      });
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Xung đột đồng thời khi chuyển lớp cho học viên');
      }
      throw err;
    }
  }

  async dropStudent(
    actor: AuthenticatedUser,
    classId: string,
    studentId: string,
    dto: DropStudentClassDto,
  ): Promise<{ status: 'DROPPED'; classId: string; studentId: string }> {
    const leftDate = resolveVnCalendarDateForDb(dto.leftDate);
    if (!leftDate) throw new BadRequestException('Ngày rời lớp không hợp lệ');
    assertEffectiveDateNotInFuture(leftDate, 'Ngày rời lớp');

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${classId} FOR UPDATE`;

      const targetClass = await tx.class.findUnique({ where: { id: classId } });
      if (!targetClass) throw new NotFoundException('Không tìm thấy lớp học');
      if (targetClass.status === ClassStatus.COMPLETED || targetClass.status === ClassStatus.ARCHIVED) {
        throw new BadRequestException('Không thể rút học viên khỏi lớp đã kết thúc hoặc lưu trữ');
      }

      const student = await this.lockAndVerifyStudent(tx, actor, studentId);

      const activeEnrollment = await tx.enrollment.findFirst({
        where: { classId, studentId, status: EnrollmentStatus.ACTIVE },
      });
      if (!activeEnrollment) {
        throw new BadRequestException('Học viên hiện không ở trạng thái đang học trong lớp này');
      }
      if (leftDate.getTime() < activeEnrollment.enrolledDate.getTime()) {
        throw new BadRequestException('Ngày rời lớp không được nhỏ hơn ngày vào lớp');
      }

      const trimmedReason = dto.reason?.trim() || null;

      await tx.enrollment.update({
        where: { id: activeEnrollment.id },
        data: {
          status: EnrollmentStatus.DROPPED,
          leftDate,
          reason: trimmedReason || 'Rút khỏi lớp / Tạm nghỉ bảo lưu',
        },
      });

      const isPureStudent =
        student.roles.length === 1 && student.roles[0] === Role.STUDENT;
      const nextStatus =
        student.status === UserStatus.INACTIVE
          ? UserStatus.INACTIVE
          : isPureStudent
            ? UserStatus.PENDING_CLASS
            : student.status;

      await tx.user.update({ where: { id: studentId }, data: { status: nextStatus } });
      if (student.studentProfile) {
        await tx.studentProfile.update({
          where: { userId: studentId },
          data: { assignedClass: null, currentClassId: null, enrolledAt: null },
        });
      }

      await writeAuditLog(tx, actor, {
        action: 'CLASS_STUDENT_DROPPED',
        targetType: 'User',
        targetId: studentId,
        metadata: {
          classId,
          classCode: targetClass.code,
          leftDate: leftDate.toISOString(),
          reason: trimmedReason,
        },
      });

      return { status: 'DROPPED' as const, classId, studentId };
    });
  }

  private async lockAndVerifyStudent(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
    studentId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${studentId} FOR UPDATE`;
    const student = await tx.user.findUnique({
      where: { id: studentId },
      include: { studentProfile: true },
    });
    if (!student || !student.roles.includes(Role.STUDENT)) {
      throw new NotFoundException('Không tìm thấy học viên');
    }
    assertActorMayModifyAccount(actor, student.roles);
    return student;
  }
}
