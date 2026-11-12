import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { QuestionSchemaPolicy } from '../policies/question-schema.policy.js';
import { toTeacherQuestionDto } from '../mappers/assessment.mapper.js';
import type { TeacherQuestionDto } from '../assessments.types.js';
import type {
  CreateQuestionDto,
  ReorderQuestionsDto,
  UpdateQuestionDto,
} from '../dto/assessments.dto.js';

const byPosition = { orderBy: { position: 'asc' as const } };

@Injectable()
export class QuestionCrudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schemaPolicy: QuestionSchemaPolicy,
  ) {}

  private async assertEditable(assessmentId: string) {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Không tìm thấy đề');
    if (assessment.isLocked) throw new ForbiddenException('Đề đã khóa, chỉ được nhân bản');
    return assessment;
  }

  async add(assessmentId: string, dto: CreateQuestionDto): Promise<TeacherQuestionDto> {
    await this.assertEditable(assessmentId);
    this.schemaPolicy.validatePayload(dto.type, dto.payload);
    const max = await this.prisma.question.aggregate({
      where: { assessmentId },
      _max: { position: true },
    });
    const created = await this.prisma.question.create({
      data: {
        assessmentId,
        type: dto.type,
        position: (max._max.position ?? 0) + 1,
        prompt: dto.prompt,
        payload: dto.payload as Prisma.InputJsonValue,
        points: dto.points,
      },
    });
    return toTeacherQuestionDto(created);
  }

  async update(assessmentId: string, questionId: string, dto: UpdateQuestionDto): Promise<TeacherQuestionDto> {
    await this.assertEditable(assessmentId);
    const existing = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!existing || existing.assessmentId !== assessmentId) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }
    const type = existing.type;
    const payload = (dto.payload ?? existing.payload) as Record<string, unknown>;
    this.schemaPolicy.validatePayload(type, payload);
    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: {
        ...(dto.prompt !== undefined ? { prompt: dto.prompt } : {}),
        ...(dto.payload !== undefined ? { payload: dto.payload as Prisma.InputJsonValue } : {}),
        ...(dto.points !== undefined ? { points: dto.points } : {}),
      },
    });
    return toTeacherQuestionDto(updated);
  }

  async remove(assessmentId: string, questionId: string): Promise<void> {
    await this.assertEditable(assessmentId);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${assessmentId} FOR UPDATE`;
      const existing = await tx.question.findUnique({ where: { id: questionId } });
      if (!existing || existing.assessmentId !== assessmentId) {
        throw new NotFoundException('Không tìm thấy câu hỏi');
      }
      await tx.question.delete({ where: { id: questionId } });
      const rest = await tx.question.findMany({ where: { assessmentId }, ...byPosition });
      for (let i = 0; i < rest.length; i += 1) {
        await tx.question.update({ where: { id: rest[i]!.id }, data: { position: i + 1 } });
      }
    });
  }

  async reorder(assessmentId: string, dto: ReorderQuestionsDto): Promise<TeacherQuestionDto[]> {
    await this.assertEditable(assessmentId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${assessmentId} FOR UPDATE`;
      const existing = await tx.question.findMany({ where: { assessmentId } });
      const ids = new Set(existing.map((q) => q.id));
      if (dto.questionIds.length !== existing.length || dto.questionIds.some((id) => !ids.has(id))) {
        throw new NotFoundException('Danh sách câu hỏi không khớp với đề');
      }
      for (let i = 0; i < dto.questionIds.length; i += 1) {
        await tx.question.update({ where: { id: dto.questionIds[i]! }, data: { position: i + 1 } });
      }
      const rows = await tx.question.findMany({ where: { assessmentId }, ...byPosition });
      return rows.map(toTeacherQuestionDto);
    });
  }
}
