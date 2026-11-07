import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TeachersService } from './teachers.service.js';
import {
  CreateTeacherDto,
  ListTeachersQueryDto,
  UpdateTeacherDto,
} from './dto/teachers.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Teachers')
@Controller('teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách tài khoản giáo viên' })
  async listTeachers(@Query() query: ListTeachersQueryDto) {
    return this.teachersService.listTeachers(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo tài khoản giáo viên mới' })
  async createTeacher(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTeacherDto,
  ) {
    return this.teachersService.createTeacher(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin và trạng thái giáo viên' })
  async updateTeacher(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.teachersService.updateTeacher(user, id, dto);
  }
}
