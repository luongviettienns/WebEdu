import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SessionChangeAction, SessionStatus, SessionType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-error.util.js';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';
import { assertValidTimeRange } from '../../classes/policies/class-schedule.util.js';
import type {
  AddManualSessionDto,
  CancelSessionDto,
  CreateMakeupSessionDto,
  RescheduleSessionDto,
} from '../dto/schedules.dto.js';
import type { SessionMutationResultDto } from '../schedules.types.js';
import { ScheduleAccessPolicy } from '../policies/schedule-access.policy.js';
import {
  assertNoSameClassSessionConflict,
  assertSessionDateNotPastVn,
  findTeacherSessionConflictWarning,
  insertMakeupSessionInsideTx,
  parseSessionCalendarDateOrThrow,
} from '../policies/session-schedule.policy.js';
import { toLessonSessionItemDto, type LessonSessionEntity } from '../mappers/session.mapper.js';
import { SESSION_DETAIL_INCLUDE } from './session-query.service.js';
import { SessionGeneratorService } from './session-generator.service.js';

@Injectable()
export class SessionWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ScheduleAccessPolicy,
    private readonly generator: SessionGeneratorService,
  ) {}

  async addManualSession(
    actor: AuthenticatedUser,
    classId: string,
    dto: AddManualSessionDto,
  ): Promise<SessionMutationResultDto> {
    const cls = await this.access.loadClassOrThrow(this.prisma, classId);
    this.access.assertAdminCanMutateSchedule(actor, cls.status);

    const sessionDate = parseSessionCalendarDateOrThrow(dto.sessionDate, 'Ngày học');
    const { startTime, endTime } = assertValidTimeRange(dto.startTime, dto.endTime);

    const { createdId, expectedEndDate, warning } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${classId} FOR UPDATE`;
      const lockedClass = await tx.class.findUniqueOrThrow({ where: { id: classId } });
      this.access.assertAdminCanMutateSchedule(actor, lockedClass.status);

      await assertNoSameClassSessionConflict(tx, classId, sessionDate, startTime, endTime);
      const teacherWarning = await findTeacherSessionConflictWarning(
        tx,
        lockedClass.teacherId,
        classId,
        sessionDate,
        startTime,
        endTime,
      );

      const created = await tx.lessonSession.create({
        data: {
          classId,
          sessionNumber: 200001,
          type: SessionType.MANUAL,
          sessionDate,
          startTime,
          endTime,
          status: SessionStatus.SCHEDULED,
          topic: dto.topic?.trim() || null,
        },
      });

      const activeCount = await tx.lessonSession.count({
        where: { classId, status: { not: SessionStatus.CANCELLED } },
      });
      if (activeCount > lockedClass.totalSessions) {
        if (activeCount > 200) {
          throw new BadRequestException('Tổng số buổi học của lớp không được vượt quá 200 buổi');
        }
        await tx.class.update({ where: { id: classId }, data: { totalSessions: activeCount } });
      }

      const nextExpectedEnd = await this.generator.renumberActiveSessionsAndSyncExpectedEndDate(
        tx,
        classId,
      );
      await tx.sessionChangeLog.create({
        data: {
          classId,
          sessionId: created.id,
          action: SessionChangeAction.ADD_MANUAL,
          actorId: actor.id,
          actorName: actor.fullName,
          newDate: sessionDate,
          newStartTime: startTime,
          newEndTime: endTime,
          reason: dto.reason?.trim() || `Thêm buổi học thủ công cho lớp ${lockedClass.code}`,
        },
      });

      return { createdId: created.id, expectedEndDate: nextExpectedEnd, warning: teacherWarning };
    });

    return this.buildMutationResult(actor, createdId, expectedEndDate, warning);
  }

  async rescheduleSession(
    actor: AuthenticatedUser,
    sessionId: string,
    dto: RescheduleSessionDto,
  ): Promise<SessionMutationResultDto> {
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Vui lòng nhập lý do đổi lịch');
    const newDate = parseSessionCalendarDateOrThrow(dto.sessionDate, 'Ngày học mới');
    assertSessionDateNotPastVn(newDate, 'Không thể đổi lịch buổi học sang ngày trong quá khứ');
    const { startTime, endTime } = assertValidTimeRange(dto.startTime, dto.endTime);

    const { expectedEndDate, warning } = await this.prisma.$transaction(async (tx) => {
      const target = await this.lockClassAndLoadSessionOrThrow(tx, sessionId, 'Không tìm thấy buổi học');
      this.access.assertAdminCanMutateSchedule(actor, target.class.status);
      if (target.status !== SessionStatus.SCHEDULED) {
        throw new BadRequestException('Chỉ được đổi lịch cho buổi học đang ở trạng thái Dự kiến');
      }

      await assertNoSameClassSessionConflict(tx, target.classId, newDate, startTime, endTime, target.id);
      const teacherWarning = await findTeacherSessionConflictWarning(
        tx,
        target.class.teacherId,
        target.classId,
        newDate,
        startTime,
        endTime,
      );

      await tx.lessonSession.update({
        where: { id: target.id },
        data: {
          sessionDate: newDate,
          startTime,
          endTime,
          isRescheduled: true,
          ...(dto.topic !== undefined ? { topic: dto.topic?.trim() || null } : {}),
        },
      });
      await tx.sessionChangeLog.create({
        data: {
          classId: target.classId,
          sessionId: target.id,
          action: SessionChangeAction.RESCHEDULE,
          actorId: actor.id,
          actorName: actor.fullName,
          previousDate: target.sessionDate,
          previousStartTime: target.startTime,
          previousEndTime: target.endTime,
          newDate,
          newStartTime: startTime,
          newEndTime: endTime,
          reason,
        },
      });

      const nextExpectedEnd = await this.generator.renumberActiveSessionsAndSyncExpectedEndDate(
        tx,
        target.classId,
      );
      return { expectedEndDate: nextExpectedEnd, warning: teacherWarning };
    });

    return this.buildMutationResult(actor, sessionId, expectedEndDate, warning);
  }

  async cancelSession(
    actor: AuthenticatedUser,
    sessionId: string,
    dto: CancelSessionDto,
  ): Promise<SessionMutationResultDto> {
    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Vui lòng nhập lý do hủy buổi học');
    if (dto.makeup) {
      const mDate = parseSessionCalendarDateOrThrow(dto.makeup.sessionDate, 'Ngày học bù');
      assertSessionDateNotPastVn(mDate, 'Không thể tạo buổi học bù vào ngày trong quá khứ');
      assertValidTimeRange(dto.makeup.startTime, dto.makeup.endTime);
    }

    const { expectedEndDate, warning } = await this.prisma.$transaction(async (tx) => {
      const target = await this.lockClassAndLoadSessionOrThrow(tx, sessionId, 'Không tìm thấy buổi học');
      this.access.assertAdminCanMutateSchedule(actor, target.class.status);
      if (target.status !== SessionStatus.SCHEDULED) {
        throw new BadRequestException('Chỉ được hủy buổi học đang ở trạng thái Dự kiến');
      }

      await tx.lessonSession.update({
        where: { id: target.id },
        data: {
          status: SessionStatus.CANCELLED,
          sessionNumber: null,
          cancelReason: reason,
          cancelledById: actor.id,
          cancelledAt: new Date(),
        },
      });
      await tx.sessionChangeLog.create({
        data: {
          classId: target.classId,
          sessionId: target.id,
          action: SessionChangeAction.CANCEL,
          actorId: actor.id,
          actorName: actor.fullName,
          previousDate: target.sessionDate,
          previousStartTime: target.startTime,
          previousEndTime: target.endTime,
          reason,
        },
      });

      const makeupRes = dto.makeup
        ? await insertMakeupSessionInsideTx(tx, actor, target, dto.makeup)
        : null;
      const nextExpectedEnd = await this.generator.renumberActiveSessionsAndSyncExpectedEndDate(
        tx,
        target.classId,
      );
      return { expectedEndDate: nextExpectedEnd, warning: makeupRes?.teacherWarning ?? null };
    });

    return this.buildMutationResult(actor, sessionId, expectedEndDate, warning);
  }

  async createMakeupSession(
    actor: AuthenticatedUser,
    cancelledSessionId: string,
    dto: CreateMakeupSessionDto,
  ): Promise<SessionMutationResultDto> {
    const mDate = parseSessionCalendarDateOrThrow(dto.sessionDate, 'Ngày học bù');
    assertSessionDateNotPastVn(mDate, 'Không thể tạo buổi học bù vào ngày trong quá khứ');
    assertValidTimeRange(dto.startTime, dto.endTime);

    try {
      const { makeupId, expectedEndDate, warning } = await this.prisma.$transaction(async (tx) => {
        const target = await this.lockClassAndLoadSessionOrThrow(
          tx,
          cancelledSessionId,
          'Không tìm thấy buổi học đã hủy',
        );
      this.access.assertAdminCanMutateSchedule(actor, target.class.status);
      if (target.status !== SessionStatus.CANCELLED) {
        throw new BadRequestException('Chỉ được tạo buổi học bù cho buổi đã bị hủy');
      }
      if (target.makeupReplacement) {
        throw new BadRequestException('Buổi học bị hủy này đã có buổi học bù thay thế');
      }

      const { createdId, teacherWarning } = await insertMakeupSessionInsideTx(
        tx,
        actor,
        target,
        dto,
        dto.reason,
      );
      const nextExpectedEnd = await this.generator.renumberActiveSessionsAndSyncExpectedEndDate(
        tx,
        target.classId,
      );
      return { makeupId: createdId, expectedEndDate: nextExpectedEnd, warning: teacherWarning };
      });

      return this.buildMutationResult(actor, makeupId, expectedEndDate, warning);
    } catch (err) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Buổi đã hủy này đã được tạo buổi học bù trước đó');
      }
      throw err;
    }
  }

  private async lockClassAndLoadSessionOrThrow(
    tx: Prisma.TransactionClient,
    sessionId: string,
    notFoundMessage: string,
  ) {
    const stub = await tx.lessonSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true },
    });
    if (!stub) throw new NotFoundException(notFoundMessage);
    await tx.$queryRaw`SELECT id FROM "classes" WHERE id = ${stub.classId} FOR UPDATE`;
    const target = await tx.lessonSession.findUnique({
      where: { id: sessionId },
      include: {
        class: { select: { id: true, teacherId: true, status: true } },
        makeupReplacement: { select: { id: true } },
      },
    });
    if (!target) throw new NotFoundException(notFoundMessage);
    return target;
  }

  private async buildMutationResult(
    actor: AuthenticatedUser,
    sessionId: string,
    expectedEndDate: Date | null,
    scheduleConflictWarning: string | null,
  ): Promise<SessionMutationResultDto> {
    const entity = (await this.prisma.lessonSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: SESSION_DETAIL_INCLUDE,
    })) as unknown as LessonSessionEntity;

    return {
      session: toLessonSessionItemDto(entity, actor, 'ADMIN', new Date()),
      expectedEndDate: expectedEndDate ? formatIsoDateUtc(expectedEndDate) : null,
      scheduleConflictWarning,
    };
  }
}
