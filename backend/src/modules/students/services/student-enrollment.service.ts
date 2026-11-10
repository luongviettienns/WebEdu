import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassStatus, EnrollmentStatus, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-error.util.js';
import { resolveVnCalendarDateForDb } from '../../../common/utils/timezone.util.js';
import { assertActorMayModifyAccount } from '../../../common/auth/superadmin-protection.policy.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type { AssignInitialClassDto } from '../dto/students.dto.js';
import { toAvailableClassDto } from '../mappers/student.mapper.js';
import type {
  AvailableClassDto,
  StudentDetailDto,
} from '../students.types.js';
import { StudentQueryService } from './student-query.service.js';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Initial class placement workflow: the only legitimate way to move
 * a student from PENDING_CLASS to ACTIVE.
 */
@Injectable()
export class StudentEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: StudentQueryService,
  ) {}

  async listAvailableClasses(): Promise<{ items: AvailableClassDto[] }> {
    const classes = await this.prisma.class.findMany({
      where: { status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] } },
      include: {
        course: { select: { name: true, level: true } },
        teacher: { select: { fullName: true } },
        _count: {
          select: {
            enrollments: { where: { status: EnrollmentStatus.ACTIVE } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'asc' }, { code: 'asc' }],
    });

    return { items: classes.map(toAvailableClassDto) };
  }

  async assignInitialClass(
    actor: AuthenticatedUser,
    studentId: string,
    dto: AssignInitialClassDto,
  ): Promise<StudentDetailDto> {
    const classNameOrId = (dto.classNameOrId ?? '').trim();
    if (!classNameOrId) {
      throw new BadRequestException('Lớp học xếp ban đầu không được để trống');
    }

    const enrolledDate = resolveVnCalendarDateForDb(dto.enrolledAt);
    if (!enrolledDate) {
      throw new BadRequestException('Thời điểm xếp lớp (enrolledAt) không hợp lệ');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const isUuid = UUID_REGEX.test(classNameOrId);
        const foundClass = await tx.class.findFirst({
          where: isUuid
            ? { OR: [{ id: classNameOrId }, { code: classNameOrId }] }
            : { code: classNameOrId },
        });
        if (!foundClass) {
          throw new NotFoundException('Lớp học không tồn tại trong hệ thống');
        }

        // Lock Hierarchy: lock "classes" before "users" to prevent cross-table deadlocks
        await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${foundClass.id} FOR UPDATE`;
        const targetClass = await tx.class.findFirst({
          where: { OR: [{ id: foundClass.id }] },
        });
        if (!targetClass) {
          throw new NotFoundException('Lớp học không tồn tại trong hệ thống');
        }
        if (
          targetClass.status !== ClassStatus.UPCOMING &&
          targetClass.status !== ClassStatus.ACTIVE
        ) {
          throw new BadRequestException(
            'Chỉ có thể xếp học viên vào lớp Sắp mở (UPCOMING) hoặc Đang học (ACTIVE)',
          );
        }

        // Row-lock the student row to serialize concurrent initial enrollment requests
        await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${studentId} FOR UPDATE`;

        const targetUser = await tx.user.findUnique({
          where: { id: studentId },
          include: { studentProfile: { include: { consent: true } } },
        });
        if (!targetUser || !targetUser.roles.includes(Role.STUDENT)) {
          throw new NotFoundException('Không tìm thấy học viên');
        }

        assertActorMayModifyAccount(actor, targetUser.roles);

        if (targetUser.status !== UserStatus.PENDING_CLASS) {
          throw new BadRequestException(
            'Chỉ có thể xếp lớp lần đầu cho học viên đang ở trạng thái Chờ xếp lớp',
          );
        }

        const existingActiveEnrollment = await tx.enrollment.findFirst({
          where: { studentId, status: EnrollmentStatus.ACTIVE },
        });
        if (existingActiveEnrollment) {
          throw new ConflictException('Học viên đã có lớp học đang hoạt động');
        }

        await tx.enrollment.create({
          data: {
            classId: targetClass.id,
            studentId,
            status: EnrollmentStatus.ACTIVE,
            enrolledDate,
          },
        });

        await tx.user.update({
          where: { id: studentId },
          data: { status: UserStatus.ACTIVE },
        });

        if (targetUser.studentProfile) {
          await tx.studentProfile.update({
            where: { userId: studentId },
            data: {
              assignedClass: targetClass.code,
              currentClassId: targetClass.id,
              enrolledAt: enrolledDate,
            },
          });
        }

        await writeAuditLog(tx, actor, {
          action: 'ASSIGN_INITIAL_CLASS',
          targetType: 'User',
          targetId: studentId,
          metadata: {
            classId: targetClass.id,
            classCode: targetClass.code,
            enrolledAt: enrolledDate.toISOString(),
            previousStatus: targetUser.status,
            newStatus: UserStatus.ACTIVE,
          },
        });
      });
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException(
          'Học viên đã được xếp lớp bởi một yêu cầu đồng thời khác',
        );
      }
      throw err;
    }

    return this.queries.getStudentById(actor, studentId);
  }
}
