import {
  Body,
  Controller,
  Get,
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
import { SystemSettingsService } from './system-settings.service.js';
import {
  CreateSystemUserDto,
  ListAuditLogsQueryDto,
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
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get('users')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách tài khoản hệ thống / quản trị (FUNC-013)' })
  async listSystemUsers() {
    return this.systemSettingsService.listSystemUsers();
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Tạo tài khoản nhân sự / Admin mới với trạng thái ACTIVE (FUNC-013)' })
  async createSystemUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSystemUserDto,
  ) {
    return this.systemSettingsService.createSystemUser(user, dto);
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
    return this.systemSettingsService.updateUserRolesAndStatus(user, id, dto);
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Lấy cấu hình Tên trung tâm & Logo (Public cho màn Login & Header)' })
  async getSystemConfig() {
    return this.systemSettingsService.getSystemConfig();
  }

  @Put('config')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật Tên trung tâm & Logo — kiểm tra Magic Bytes PNG/JPG (FUNC-013)' })
  async updateSystemConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    return this.systemSettingsService.updateSystemConfig(
      user,
      dto as UpdateSystemConfigDto & Record<string, unknown>,
    );
  }

  @Get('audit-logs')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Nhật ký vận hành hệ thống mới nhất lên đầu, chỉ đọc (FUNC-013)' })
  async listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.systemSettingsService.listAuditLogs(query);
  }
}
