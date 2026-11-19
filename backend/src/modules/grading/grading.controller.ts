import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ProtectedJsonBodyInterceptor } from '../../common/http/protected-json-body.interceptor.js';
import {
  AdjustGradeSubmissionDto,
  AiGradeSubmissionDto,
  AiSuggestBatchGradeDto,
  GradingTrackerQueryDto,
  ManualGradeSubmissionDto,
  RecordOverdueZeroDto,
  SubmissionBatchSelectionDto,
} from './dto/grading.dto.js';
import { PublishedGradesRepository } from './repositories/published-grades.repository.js';
import { AiEssayGradingService } from './services/ai-essay-grading.service.js';
import { AutoGradingService } from './services/auto-grading.service.js';
import { GradeAdjustmentService } from './services/grade-adjustment.service.js';
import { GradePublicationService } from './services/grade-publication.service.js';
import { GradingTrackerService } from './services/grading-tracker.service.js';
import { TeacherGradingService } from './services/teacher-grading.service.js';

@ApiTags('Grading')
@Controller()
export class GradingController {
  constructor(
    private readonly autoGradingService: AutoGradingService,
    private readonly aiEssayGradingService: AiEssayGradingService,
    private readonly gradingTrackerService: GradingTrackerService,
    private readonly teacherGradingService: TeacherGradingService,
    private readonly gradePublicationService: GradePublicationService,
    private readonly gradeAdjustmentService: GradeAdjustmentService,
    private readonly publishedGradesRepository: PublishedGradesRepository,
  ) {}

  @Get('assignments/:assignmentId/grading-tracker')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Bảng theo dõi chấm điểm và học viên quá hạn chưa nộp' })
  getAssignmentGradingTracker(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Query() query?: GradingTrackerQueryDto,
  ) {
    return this.gradingTrackerService.getAssignmentGradingTracker(assignmentId, actor, query);
  }

  @Post('assignments/:assignmentId/overdue-zero')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Ghi nhận 0 điểm tường minh cho học viên quá hạn chưa nộp' })
  recordOverdueZero(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: RecordOverdueZeroDto,
  ) {
    return this.gradingTrackerService.recordOverdueZero(assignmentId, dto, actor);
  }

  @Post('assignments/:assignmentId/confirm-grades')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Xác nhận hàng loạt bài nộp đã chấm đủ điểm' })
  confirmAssignmentGradesBatch(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: SubmissionBatchSelectionDto,
  ) {
    return this.gradePublicationService.confirmAssignmentGradesBatch(assignmentId, dto, actor);
  }

  @Post('assignments/:assignmentId/publish-grades')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Công bố điểm các bài đã xác nhận GRADED -> RETURNED' })
  publishAssignmentGrades(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: SubmissionBatchSelectionDto,
  ) {
    return this.gradePublicationService.publishAssignmentGrades(assignmentId, dto, actor);
  }

  @Post('assignments/:assignmentId/ai-grade')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(ProtectedJsonBodyInterceptor)
  @ApiOperation({ summary: 'Gọi AI gợi ý chấm nháp hàng loạt cho bài nộp của bài giao (Zero-PII)' })
  suggestAssignmentEssayGradesBatch(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto?: AiSuggestBatchGradeDto,
  ) {
    return this.aiEssayGradingService.suggestEssayGradesForAssignmentBatch(assignmentId, dto, actor);
  }

  @Get('assignments/:assignmentId/published-result')
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Học viên xem kết quả sau công bố với cổng Zero-Leak' })
  getStudentPublishedResult(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.publishedGradesRepository.getStudentPublishedResult(assignmentId, actor);
  }

  @Get('submissions/:submissionId/grading-detail')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Xem chi tiết bài làm, đáp án mẫu, gợi ý AI và lịch sử sửa điểm' })
  getSubmissionGradingDetail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.teacherGradingService.getSubmissionGradingDetail(submissionId, actor);
  }

  @Post('submissions/:submissionId/auto-grade')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Chấm tự động các câu hỏi có đáp án xác định (Rule-based)' })
  autoGradeSubmission(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.autoGradingService.gradeSubmission(submissionId, actor);
  }

  @Post('submissions/:submissionId/ai-grade')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @UseInterceptors(ProtectedJsonBodyInterceptor)
  @ApiOperation({ summary: 'Gọi AI gợi ý chấm nháp câu tự luận theo yêu cầu (Zero-PII)' })
  suggestEssayGrades(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto?: AiGradeSubmissionDto,
  ) {
    return this.aiEssayGradingService.suggestEssayGradesForSubmission(submissionId, actor, dto);
  }

  @Patch('submissions/:submissionId/manual-grade')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Giáo viên chấm điểm câu tự luận, áp dụng gợi ý AI & nhận xét' })
  gradeSubmissionManually(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ManualGradeSubmissionDto,
  ) {
    return this.teacherGradingService.gradeSubmissionManually(submissionId, dto, actor);
  }

  @Post('submissions/:submissionId/confirm-grade')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Xác nhận điểm bài nộp chuyển sang trạng thái GRADED' })
  confirmSubmissionGrade(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.gradePublicationService.confirmSubmissionGrade(submissionId, actor);
  }

  @Patch('submissions/:submissionId/adjust-grade')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Chỉnh sửa điểm sau xác nhận/công bố kèm lý do & GradeAuditLog' })
  adjustConfirmedOrPublishedGrade(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: AdjustGradeSubmissionDto,
  ) {
    return this.gradeAdjustmentService.adjustConfirmedOrPublishedGrade(submissionId, dto, actor);
  }
}
