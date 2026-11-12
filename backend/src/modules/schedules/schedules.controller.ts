import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import {
  AddManualSessionDto,
  CancelSessionDto,
  CreateMakeupSessionDto,
  ListCalendarSessionsQueryDto,
  ListClassSessionsQueryDto,
  ListSessionChangeLogsQueryDto,
  RescheduleSessionDto,
} from './dto/schedules.dto.js';
import { SessionQueryService } from './services/session-query.service.js';
import { SessionWorkflowService } from './services/session-workflow.service.js';

@Controller()
export class SchedulesController {
  constructor(
    private readonly queryService: SessionQueryService,
    private readonly workflowService: SessionWorkflowService,
  ) {}

  @Get('schedules/calendar')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  listCalendarSessions(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListCalendarSessionsQueryDto,
  ) {
    return this.queryService.listCalendarSessions(actor, query);
  }

  @Get('schedules/change-logs')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  listScheduleChangeLogs(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListSessionChangeLogsQueryDto,
  ) {
    return this.queryService.listScheduleChangeLogs(actor, query);
  }

  @Get('classes/:classId/sessions')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  listClassSessions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() query: ListClassSessionsQueryDto,
  ) {
    return this.queryService.listClassSessions(actor, classId, query);
  }

  @Post('classes/:classId/sessions')
  @Roles(Role.ADMIN)
  addManualSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: AddManualSessionDto,
  ) {
    return this.workflowService.addManualSession(actor, classId, dto);
  }

  @Get('sessions/:sessionId')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  getSessionDetail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.queryService.getSessionDetail(actor, sessionId);
  }

  @Patch('sessions/:sessionId/reschedule')
  @Roles(Role.ADMIN)
  rescheduleSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RescheduleSessionDto,
  ) {
    return this.workflowService.rescheduleSession(actor, sessionId, dto);
  }

  @Post('sessions/:sessionId/cancel')
  @Roles(Role.ADMIN)
  cancelSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CancelSessionDto,
  ) {
    return this.workflowService.cancelSession(actor, sessionId, dto);
  }

  @Post('sessions/:sessionId/makeup')
  @Roles(Role.ADMIN)
  createMakeupSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateMakeupSessionDto,
  ) {
    return this.workflowService.createMakeupSession(actor, sessionId, dto);
  }
}
