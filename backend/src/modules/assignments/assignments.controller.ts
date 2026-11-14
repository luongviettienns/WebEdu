import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  AssignAssessmentDto,
  AutosaveSubmissionDto,
  ListAssignmentSubmissionsQueryDto,
  ReopenSubmissionDto,
  SubmitSubmissionDto,
} from './dto/assignments.dto.js';
import { AssignmentDeliveryService } from './services/assignment-delivery.service.js';
import { StudentSubmissionService } from './services/student-submission.service.js';

@Controller()
export class AssignmentsController {
  constructor(
    private readonly delivery: AssignmentDeliveryService,
    private readonly submissions: StudentSubmissionService,
  ) {}

  @Post('assessments/:assessmentId/assign')
  @Roles(Role.ADMIN, Role.TEACHER)
  assignToClasses(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
    @Body() dto: AssignAssessmentDto,
  ) {
    return this.delivery.assignToClasses(assessmentId, dto, actor);
  }

  @Get('classes/:classId/assignments')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  listByClass(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('classId', ParseUUIDPipe) classId: string,
  ) {
    return this.delivery.listByClass(classId, actor);
  }

  @Get('assignments/me')
  @Roles(Role.STUDENT)
  listMyAssignments(@CurrentUser() actor: AuthenticatedUser) {
    return this.submissions.listMyAssignments(actor);
  }

  @Get('assignments/:assignmentId/submissions')
  @Roles(Role.ADMIN, Role.TEACHER)
  getAssignmentSubmissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Query() query?: ListAssignmentSubmissionsQueryDto,
  ) {
    return this.delivery.getAssignmentSubmissionsForTeacher(assignmentId, actor, query);
  }

  @Post('assignments/:assignmentId/submissions/start')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  startOrResume(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.submissions.startOrResume(assignmentId, actor);
  }

  @Patch('assignments/:assignmentId/submissions/autosave')
  @Roles(Role.STUDENT)
  autosave(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: AutosaveSubmissionDto,
  ) {
    return this.submissions.autosave(assignmentId, dto, actor);
  }

  @Post('assignments/:assignmentId/submissions/submit')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  submit(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: SubmitSubmissionDto,
  ) {
    return this.submissions.submit(assignmentId, dto, actor);
  }

  @Get('assignments/:assignmentId/submissions/me')
  @Roles(Role.STUDENT)
  getMySubmittedView(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.submissions.getMySubmittedView(assignmentId, actor);
  }

  @Get('assignments/:assignmentId/media/:mediaId')
  @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  streamMedia(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.submissions.streamAssignmentMedia(assignmentId, mediaId, actor);
  }

  @Post('submissions/:submissionId/reopen')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  reopenSubmission(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReopenSubmissionDto,
  ) {
    return this.delivery.reopenSubmission(submissionId, dto, actor);
  }
}
