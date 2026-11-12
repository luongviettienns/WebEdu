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

@ApiTags('Students')
@Controller('students')
export class StudentsController {
  constructor(
    private readonly queries: StudentQueryService,
    private readonly crud: StudentCrudService,
    private readonly enrollment: StudentEnrollmentService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Danh sách hồ sơ học viên' })
  async listStudents(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListStudentsQueryDto,
  ) {
    return this.queries.listStudents(actor, query);
  }

  @Get('pending-enrollment')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Danh sách học viên chờ xếp lớp' })
  async getPendingEnrollmentQueue(@Query() query: ListPendingEnrollmentQueryDto) {
    return this.queries.getPendingEnrollmentQueue(query);
  }

  @Get('available-classes')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Danh sách lớp học đang mở phục vụ xếp lớp ban đầu',
  })
  async listAvailableClasses() {
    return this.enrollment.listAvailableClasses();
  }

  @Get(':id')
  @Roles(Role.STUDENT, Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Chi tiết hồ sơ học viên' })
  async getStudentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.queries.getStudentById(user, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Cập nhật hồ sơ học viên' })
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
  @ApiOperation({ summary: 'Xếp lớp ban đầu và kích hoạt tài khoản học viên' })
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
    summary: 'Dữ liệu học tập của học viên',
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
    summary: 'Lịch sử các lớp đã học của học viên',
  })
  async getStudentClassHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.queries.getStudentClassHistory(user, id);
  }
}
