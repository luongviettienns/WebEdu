import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import {
  CreateAssessmentDto,
  CreateQuestionDto,
  ListAssessmentsQueryDto,
  ReorderQuestionsDto,
  UpdateAssessmentDto,
  UpdateQuestionDto,
} from './dto/assessments.dto.js';
import { AssessmentCrudService } from './services/assessment-crud.service.js';
import { QuestionCrudService } from './services/question-crud.service.js';

@Controller('assessments')
@Roles(Role.ADMIN, Role.TEACHER)
export class AssessmentsController {
  constructor(
    private readonly assessments: AssessmentCrudService,
    private readonly questions: QuestionCrudService,
  ) {}

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateAssessmentDto) {
    return this.assessments.create(dto, actor.id);
  }

  @Get()
  list(@Query() query: ListAssessmentsQueryDto) {
    return this.assessments.list(query);
  }

  @Get(':id')
  getDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.getDetail(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssessmentDto) {
    return this.assessments.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.assessments.remove(id);
    return { success: true };
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.duplicate(id, actor.id);
  }

  @Post(':id/publish')
  publish(@Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.publish(id);
  }

  @Post(':id/questions')
  addQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questions.add(id, dto);
  }

  @Put(':id/questions/reorder')
  reorderQuestions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderQuestionsDto) {
    return this.questions.reorder(id, dto);
  }

  @Patch(':id/questions/:qid')
  updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qid', ParseUUIDPipe) qid: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questions.update(id, qid, dto);
  }

  @Delete(':id/questions/:qid')
  async removeQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qid', ParseUUIDPipe) qid: string,
  ) {
    await this.questions.remove(id, qid);
    return { success: true };
  }
}
