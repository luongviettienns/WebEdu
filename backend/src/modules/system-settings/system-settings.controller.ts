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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AiGradingConfigService } from './services/ai-grading-config.service.js';
import { SystemConfigService } from './services/system-config.service.js';
import { SystemUsersService } from './services/system-users.service.js';
import { UserRoleStatusService } from './services/user-role-status.service.js';
import {
  CreateSystemUserDto,
  ListAuditLogsQueryDto,
  ListSystemUsersQueryDto,
  TestAiGradingConnectionDto,
  UpdateAiGradingConfigDto,
  UpdateSystemConfigDto,
  UpdateUserRolesStatusDto,
} from './dto/system-settings.dto.js';
import { Public, Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

@ApiTags('System Settings')
@Controller('system-settings')
export class SystemSettingsController {
  constructor(
    private readonly systemUsersService: SystemUsersService,
    private readonly userRoleStatusService: UserRoleStatusService,
    private readonly systemConfigService: SystemConfigService,
    private readonly aiGradingConfigService: AiGradingConfigService,
  ) {}

  @Get('users')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách tài khoản quản trị hệ thống' })
  async listSystemUsers(@Query() query: ListSystemUsersQueryDto) {
    return this.systemUsersService.listSystemUsers(query);
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Tạo tài khoản nhân sự / quản trị mới' })
  async createSystemUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSystemUserDto,
  ) {
    return this.systemUsersService.createSystemUser(user, dto);
  }

  @Patch('users/:id/roles')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Cập nhật phân quyền và trạng thái tài khoản quản trị',
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
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Lấy cấu hình Tên trung tâm và Logo' })
  async getSystemConfig() {
    return this.systemConfigService.getSystemConfig();
  }

  @Put('config')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật Tên trung tâm và Logo' })
  async updateSystemConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSystemConfigDto,
  ) {
    return this.systemConfigService.updateSystemConfig(user, dto);
  }

  @Get('audit-logs')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách nhật ký vận hành hệ thống' })
  async listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.systemConfigService.listAuditLogs(query);
  }

  @Get('ai-grading')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Lấy cấu hình AI gợi ý chấm bài tự luận (Superadmin)' })
  async getAiGradingConfig() {
    return this.aiGradingConfigService.getAiGradingConfig();
  }

  @Put('ai-grading')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật cấu hình AI đa provider (Superadmin)' })
  async updateAiGradingConfig(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAiGradingConfigDto,
  ) {
    return this.aiGradingConfigService.updateAiGradingConfig(user, dto);
  }

  @Post('ai-grading/test')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Kiểm tra kết nối tới nhà cung cấp AI (Superadmin)' })
  async testAiGradingConnection(@Body() dto: TestAiGradingConnectionDto) {
    return this.aiGradingConfigService.testConnection(dto);
  }
}
