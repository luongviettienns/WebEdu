import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { ImportAssessmentDto } from './dto/import.dto.js';
import { decodeUploadFilename } from './policies/media-upload.policy.js';
import { AssessmentCrudService } from './services/assessment-crud.service.js';
import { DocumentImportService } from './services/document-import.service.js';
import { QuestionCrudService } from './services/question-crud.service.js';

@Controller('assessments')
@Roles(Role.ADMIN, Role.TEACHER)
export class AssessmentsController {
  constructor(
    private readonly assessments: AssessmentCrudService,
    private readonly questions: QuestionCrudService,
    private readonly imports: DocumentImportService,
  ) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  importDocument(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
    @Body() dto: ImportAssessmentDto,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Chỉ hỗ trợ file .docx, .pdf tối đa 20MB');
    }
    return this.imports.importFile(actor.id, decodeUploadFilename(file.originalname), file.buffer, dto);
  }

  @Get(':id/review')
  getReview(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.imports.getReview(id, actor);
  }

  @Get(':id/original')
  @Header('X-Content-Type-Options', 'nosniff')
  streamOriginal(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.streamOriginal(id, actor);
  }

  @Get(':id/media')
  listMedia(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.listMedia(id, actor);
  }

  @Post(':id/media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadMedia(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
  ) {
    if (!file?.buffer) throw new BadRequestException('Chỉ hỗ trợ ảnh hoặc audio');
    return this.assessments.uploadMedia(id, decodeUploadFilename(file.originalname), file.buffer, actor);
  }

  @Get(':id/media/:mediaId')
  @Header('X-Content-Type-Options', 'nosniff')
  streamMedia(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.assessments.streamMedia(id, mediaId, actor);
  }

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateAssessmentDto) {
    return this.assessments.create(dto, actor.id);
  }

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: ListAssessmentsQueryDto) {
    return this.assessments.list(query, actor);
  }

  @Get(':id')
  getDetail(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.getDetail(id, actor);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessments.update(id, dto, actor);
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.assessments.remove(id, actor);
    return { success: true };
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.duplicate(id, actor);
  }

  @Post(':id/publish')
  publish(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assessments.publish(id, actor);
  }

  @Post(':id/questions')
  addQuestion(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.questions.add(id, dto, actor);
  }

  @Put(':id/questions/reorder')
  reorderQuestions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.questions.reorder(id, dto, actor);
  }

  @Patch(':id/questions/:qid')
  updateQuestion(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qid', ParseUUIDPipe) qid: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questions.update(id, qid, dto, actor);
  }

  @Delete(':id/questions/:qid')
  async removeQuestion(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('qid', ParseUUIDPipe) qid: string,
  ) {
    await this.questions.remove(id, qid, actor);
    return { success: true };
  }
}
