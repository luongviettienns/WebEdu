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
import { StudentsService } from './students.service.js';
import {
  AssignInitialClassDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from './dto/students.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';

@ApiTags('Students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách học viên (FUNC-007)' })
  async listStudents(@Query() query: ListStudentsQueryDto) {
    return this.studentsService.listStudents(query);
  }

  @Get('pending-enrollment')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách học viên chờ xếp lớp mới nhất lên đầu (FUNC-008)' })
  async getPendingEnrollmentQueue() {
    return this.studentsService.getPendingEnrollmentQueue();
  }

  @Get(':id')
  @Roles(Role.STUDENT, Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Chi tiết hồ sơ học viên (FUNC-007, FUNC-010)' })
  async getStudentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.studentsService.getStudentById(user, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật hồ sơ học viên kèm bất biến khóa ngày sinh (FUNC-007)' })
  async updateStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.updateStudent(user, id, dto);
  }

  @Post(':id/assign-initial-class')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Xếp lớp ban đầu và kích hoạt tài khoản học viên (FUNC-008)' })
  async assignInitialClass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignInitialClassDto,
  ) {
    return this.studentsService.assignInitialClass(user, id, dto);
  }

  @Get(':id/learning-records')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Dữ liệu học tập học viên — chặn tuyệt đối SUPERADMIN theo FUNC-013 và chặn IDOR theo FUNC-010',
  })
  async getStudentLearningRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.studentsService.getStudentLearningRecords(user, id);
  }

  @Get(':id/class-history')
  @Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Lịch sử lớp học của học viên — HV xem của mình, Admin xem tất cả, chặn GV xem lịch sử lớp cũ (DEC-024)',
  })
  async getStudentClassHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.studentsService.getStudentClassHistory(user, id);
  }
}
