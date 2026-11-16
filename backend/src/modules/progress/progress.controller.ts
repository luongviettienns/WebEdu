import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AdminOverviewQueryDto, GetStudentProgressQueryDto } from './dto/progress.dto.js';
import { AdminOverviewService } from './services/admin-overview.service.js';
import { ClassProgressService } from './services/class-progress.service.js';
import { StudentProgressService } from './services/student-progress.service.js';

@ApiTags('Progress')
@Controller()
export class ProgressController {
  constructor(
    private readonly studentProgressService: StudentProgressService,
    private readonly classProgressService: ClassProgressService,
    private readonly adminOverviewService: AdminOverviewService,
  ) {}

  @Get('progress/me')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Tiến độ học tập, chuyên cần và bảng điểm đã công bố của học viên' })
  getMyProgress(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: GetStudentProgressQueryDto,
  ) {
    return this.studentProgressService.getMyProgress(actor, query);
  }

  @Get('classes/:classId/progress')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Báo cáo tiến độ, chuyên cần, BTVN và tổng kết điểm theo lớp học' })
  getClassProgress(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.classProgressService.getClassProgress(actor, classId);
  }

  @Get('progress/admin-overview')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Tổng quan vận hành các lớp học và lịch giảng dạy cho Admin' })
  getAdminOverview(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AdminOverviewQueryDto,
  ) {
    return this.adminOverviewService.getOverview(actor, query);
  }
}
