import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SystemConfigService } from './services/system-config.service.js';
import { SystemUsersService } from './services/system-users.service.js';
import { UserRoleStatusService } from './services/user-role-status.service.js';
import {
  CreateSystemUserDto,
  ListAuditLogsQueryDto,
  ListSystemUsersQueryDto,
  UpdateSystemConfigDto,
  UpdateUserRolesStatusDto,
} from './dto/system-settings.dto.js';
import { Public, Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('System Settings')
@Controller('system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemSettingsController {
  constructor(
    private readonly systemUsersService: SystemUsersService,
    private readonly userRoleStatusService: UserRoleStatusService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  @Get('users')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách tài khoản hệ thống / quản trị (FUNC-013)' })
  async listSystemUsers(@Query() query: ListSystemUsersQueryDto) {
    return this.systemUsersService.listSystemUsers(query);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Tạo tài khoản nhân sự / Admin mới với trạng thái ACTIVE (FUNC-013)' })
  async createSystemUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSystemUserDto,
  ) {
    return this.systemUsersService.createSystemUser(user, dto);
  }

  @Patch('users/:id/roles')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary:
      'Cập nhật vai trò / trạng thái tài khoản — chống tự khóa và bảo vệ Superadmin cuối cùng (FUNC-013, SEC-07)',
  })
  async updateUserRolesAndStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesStatusDto,
  ) {
    return this.userRoleStatusService.updateUserRolesAndStatus(user, id, dto);
  }

  @Public()
  @Get('config')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  @ApiOperation({ summary: 'Lấy cấu hình Tên trung tâm & Logo (Public cho màn Login & Header)' })
  async getSystemConfig() {
    return this.systemConfigService.getSystemConfig();
  }

  @Put('config')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật Tên trung tâm & Logo — kiểm tra Magic Bytes PNG/JPG (FUNC-013)' })
  async updateSystemConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    return this.systemConfigService.updateSystemConfig(user, dto);
  }

  @Get('audit-logs')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Nhật ký vận hành hệ thống mới nhất lên đầu, chỉ đọc (FUNC-013)' })
  async listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.systemConfigService.listAuditLogs(query);
  }
}
