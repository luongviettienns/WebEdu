import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { QuestionSchemaPolicy } from '../policies/question-schema.policy.js';
import { toTeacherAssessmentDto } from '../mappers/assessment.mapper.js';
import type { TeacherAssessmentDto } from '../assessments.types.js';
import type {
  CreateAssessmentDto,
  ListAssessmentsQueryDto,
  UpdateAssessmentDto,
} from '../dto/assessments.dto.js';

const QUESTIONS_ORDERED = { orderBy: { position: 'asc' as const } };

@Injectable()
export class AssessmentCrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schemaPolicy: QuestionSchemaPolicy,
  ) {}

  async create(dto: CreateAssessmentDto, actorId: string): Promise<TeacherAssessmentDto> {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Không tìm thấy khóa học');
    const created = await this.prisma.assessment.create({
      data: {
        title: dto.title.trim(),
        type: dto.type,
        courseId: dto.courseId,
        durationMinutes: dto.durationMinutes ?? null,
        createdById: actorId,
      },
      include: { questions: QUESTIONS_ORDERED },
    });
    return toTeacherAssessmentDto(created);
  }

  async list(query: ListAssessmentsQueryDto): Promise<TeacherAssessmentDto[]> {
    const search = query.search?.trim();
    const where: Prisma.AssessmentWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    };
    const rows = await this.prisma.assessment.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { questions: { select: { points: true } } },
    });
    return rows.map((a) => toTeacherAssessmentDto({ ...a, questions: [] }));
  }

  async getDetail(id: string): Promise<TeacherAssessmentDto> {
    const row = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: QUESTIONS_ORDERED },
    });
    if (!row) throw new NotFoundException('Không tìm thấy đề');
    return toTeacherAssessmentDto(row);
  }

  async update(id: string, dto: UpdateAssessmentDto): Promise<TeacherAssessmentDto> {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy đề');
    if (existing.isLocked) throw new ForbiddenException('Đề đã khóa, chỉ được nhân bản');
    const updated = await this.prisma.assessment.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
      },
      include: { questions: QUESTIONS_ORDERED },
    });
    return toTeacherAssessmentDto(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy đề');
    if (existing.status === AssessmentStatus.PUBLISHED || existing.isLocked) {
      throw new ConflictException('Đề đã phát hành, chỉ được nhân bản bản mới');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { assessmentId: id } });
      await tx.assessment.delete({ where: { id } });
    });
  }

  async duplicate(id: string, actorId: string): Promise<TeacherAssessmentDto> {
    const source = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: QUESTIONS_ORDERED },
    });
    if (!source) throw new NotFoundException('Không tìm thấy đề');
    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.assessment.create({
        data: {
          title: `${source.title} (bản sao)`,
          type: source.type,
          courseId: source.courseId,
          durationMinutes: source.durationMinutes,
          createdById: actorId,
        },
      });
      await tx.question.createMany({
        data: source.questions.map((q, i) => ({
          assessmentId: copy.id,
          type: q.type,
          position: i + 1,
          prompt: q.prompt,
          payload: q.payload as Prisma.InputJsonValue,
          points: q.points,
          needsReview: q.needsReview,
        })),
      });
      const full = await tx.assessment.findUnique({
        where: { id: copy.id },
        include: { questions: QUESTIONS_ORDERED },
      });
      return toTeacherAssessmentDto(full!);
    });
  }

  async publish(id: string): Promise<TeacherAssessmentDto> {
    const existing = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: QUESTIONS_ORDERED },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy đề');
    if (existing.questions.some((q) => q.needsReview)) {
      throw new BadRequestException('Còn câu hỏi cần kiểm tra, chưa thể phát hành');
    }
    for (const q of existing.questions) {
      this.schemaPolicy.validatePayload(q.type, q.payload);
      this.assertPublishableEssay(q.type, q.payload);
    }
    const updated = await this.prisma.assessment.update({
      where: { id },
      data: { status: AssessmentStatus.PUBLISHED },
      include: { questions: QUESTIONS_ORDERED },
    });
    return toTeacherAssessmentDto(updated);
  }

  private assertPublishableEssay(type: string, payload: unknown): void {
    if (type !== 'ESSAY') return;
    const p = (payload ?? {}) as Record<string, unknown>;
    const hasSample = typeof p.sampleAnswer === 'string' && p.sampleAnswer.trim().length > 0;
    const hasRubric = typeof p.rubric === 'string' && p.rubric.trim().length > 0;
    if (!hasSample && !hasRubric) {
      throw new BadRequestException('Câu tự luận cần đáp án mẫu hoặc rubric trước khi phát hành');
    }
  }
}
