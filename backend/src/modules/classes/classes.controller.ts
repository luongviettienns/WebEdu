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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import {
  CompleteClassDto,
  CreateClassDto,
  DropStudentClassDto,
  EnrollStudentsDto,
  GetClassDetailQueryDto,
  ListClassesQueryDto,
  ReopenClassDto,
  TransferStudentClassDto,
  UpdateClassDto,
} from './dto/classes.dto.js';
import { ClassQueryService } from './services/class-query.service.js';
import { ClassCrudService } from './services/class-crud.service.js';
import { ClassEnrollmentService } from './services/class-enrollment.service.js';
import { ClassLifecycleService } from './services/class-lifecycle.service.js';

@ApiTags('Classes')
@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(
    private readonly queryService: ClassQueryService,
    private readonly crudService: ClassCrudService,
    private readonly enrollmentService: ClassEnrollmentService,
    private readonly lifecycleService: ClassLifecycleService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Danh sách lớp học theo phạm vi phân quyền' })
  async listClasses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListClassesQueryDto,
  ) {
    return this.queryService.listClasses(user, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({
    summary: 'Chi tiết lớp học, danh sách học viên và lịch sử giáo viên',
  })
  async getClassById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: GetClassDetailQueryDto,
  ) {
    return this.queryService.getClassById(user, id, query);
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo mới lớp học và gán giáo viên phụ trách' })
  async createClass(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClassDto,
  ) {
    return this.crudService.createClass(user, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật thông tin lớp học, lịch học hoặc thay đổi giáo viên',
  })
  async updateClass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.crudService.updateClass(user, id, dto);
  }

  @Post(':id/enrollments')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Thêm một hoặc nhiều học viên vào lớp học' })
  async enrollStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EnrollStudentsDto,
  ) {
    return this.enrollmentService.enrollStudents(user, id, dto);
  }

  @Post(':id/enrollments/:studentId/transfer')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Chuyển học viên từ lớp hiện tại sang lớp khác đang mở',
  })
  async transferStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: TransferStudentClassDto,
  ) {
    return this.enrollmentService.transferStudent(user, id, studentId, dto);
  }

  @Post(':id/enrollments/:studentId/drop')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ghi nhận học viên rút khỏi lớp hoặc bảo lưu' })
  async dropStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() dto: DropStudentClassDto,
  ) {
    return this.enrollmentService.dropStudent(user, id, studentId, dto);
  }

  @Post(':id/complete')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kết thúc lớp học, chuyển sang trạng thái chỉ đọc',
  })
  async completeClass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteClassDto,
  ) {
    return this.lifecycleService.completeClass(user, id, dto);
  }

  @Post(':id/reopen')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mở lại lớp học đã kết thúc trong thời hạn 7 ngày',
  })
  async reopenClass(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReopenClassDto,
  ) {
    return this.lifecycleService.reopenClass(user, id, dto);
  }
}
