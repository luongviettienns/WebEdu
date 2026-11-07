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
import { StudentCrudService } from './services/student-crud.service.js';
import { StudentEnrollmentService } from './services/student-enrollment.service.js';
import { StudentQueryService } from './services/student-query.service.js';
import {
  AssignInitialClassDto,
  ListPendingEnrollmentQueryDto,
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
  constructor(
    private readonly queries: StudentQueryService,
    private readonly crud: StudentCrudService,
    private readonly enrollment: StudentEnrollmentService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách học viên (FUNC-007)' })
  async listStudents(@Query() query: ListStudentsQueryDto) {
    return this.queries.listStudents(query);
  }

  @Get('pending-enrollment')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Danh sách học viên chờ xếp lớp mới nhất lên đầu (FUNC-008)' })
  async getPendingEnrollmentQueue(@Query() query: ListPendingEnrollmentQueryDto) {
    return this.queries.getPendingEnrollmentQueue(query);
  }

  @Get('available-classes')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Danh sách lớp học Sắp mở / Đang học phục vụ xếp lớp ban đầu (FUNC-008)',
  })
  async listAvailableClasses() {
    return this.enrollment.listAvailableClasses();
  }

  @Get(':id')
  @Roles(Role.STUDENT, Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Chi tiết hồ sơ học viên (FUNC-007, FUNC-010)' })
  async getStudentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.queries.getStudentById(user, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật hồ sơ học viên kèm bất biến khóa ngày sinh (FUNC-007)' })
  async updateStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.crud.updateStudent(user, id, dto);
  }

  @Post(':id/assign-initial-class')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Xếp lớp ban đầu và kích hoạt tài khoản học viên (FUNC-008)' })
  async assignInitialClass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignInitialClassDto,
  ) {
    return this.enrollment.assignInitialClass(user, id, dto);
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
    return this.queries.getStudentLearningRecords(user, id);
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
    return this.queries.getStudentClassHistory(user, id);
  }
}
