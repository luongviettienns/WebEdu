import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { GetMyAttendanceQueryDto, SaveSessionAttendanceDto } from './dto/attendance.dto.js';
import { AttendanceCrudService } from './services/attendance-crud.service.js';
import { AttendanceQueryService } from './services/attendance-query.service.js';

@Controller()
export class AttendanceController {
  constructor(
    private readonly queryService: AttendanceQueryService,
    private readonly crudService: AttendanceCrudService,
  ) {}

  @Get('sessions/:sessionId/attendance')
  @Roles(Role.ADMIN, Role.TEACHER)
  getSessionAttendanceSheet(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.queryService.getSessionAttendanceSheet(actor, sessionId);
  }

  @Put('sessions/:sessionId/attendance')
  @Roles(Role.ADMIN, Role.TEACHER)
  saveSessionAttendance(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SaveSessionAttendanceDto,
  ) {
    return this.crudService.saveSessionAttendance(actor, sessionId, dto);
  }

  @Get('classes/:classId/attendance/matrix')
  @Roles(Role.ADMIN, Role.TEACHER)
  getClassAttendanceMatrix(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.queryService.getClassAttendanceMatrix(actor, classId);
  }

  @Get('attendance/me')
  @Roles(Role.STUDENT)
  getMyAttendance(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: GetMyAttendanceQueryDto,
  ) {
    return this.queryService.getStudentMyAttendance(actor, query);
  }
}
