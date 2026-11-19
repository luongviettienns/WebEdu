import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ListNotificationsQueryDto } from './dto/notifications.dto.js';
import { NotificationQueryService } from './services/notification-query.service.js';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly queryService: NotificationQueryService) {}

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Danh sách thông báo trong hệ thống của người dùng hiện tại' })
  listMyNotifications(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.queryService.listForUser(actor, query);
  }

  @Get('unread-count')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Đếm số lượng thông báo chưa đọc của người dùng hiện tại' })
  getUnreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.queryService.getUnreadCount(actor);
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Đánh dấu một thông báo đã đọc' })
  markAsRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.queryService.markAsRead(actor, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @ApiOperation({ summary: 'Đánh dấu toàn bộ thông báo của người dùng là đã đọc' })
  markAllAsRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.queryService.markAllAsRead(actor);
  }
}
