import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import {
  assertEditableAssessment,
  type AssessmentActor,
} from '../policies/assessment-access.policy.js';
import {
  assertValidMediaUuids,
  collectRequiredMedia,
} from '../policies/payload-media.util.js';
import { QuestionSchemaPolicy } from '../policies/question-schema.policy.js';
import { toTeacherQuestionDto } from '../mappers/assessment.mapper.js';
import { MAX_ASSESSMENT_QUESTIONS, type TeacherQuestionDto } from '../assessments.types.js';
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

  async add(assessmentId: string, dto: CreateQuestionDto, actor: AssessmentActor): Promise<TeacherQuestionDto> {
    const prompt = dto.prompt.trim();
    if (!prompt) throw new BadRequestException('Nội dung câu hỏi không được để trống');
    this.schemaPolicy.validatePayload(dto.type, dto.payload);
    return this.prisma.$transaction(async (tx) => {
      await this.lockEditable(tx, assessmentId, actor);
      await this.assertMediaOwned(tx, assessmentId, dto.type, dto.payload);
      const max = await tx.question.aggregate({ where: { assessmentId }, _max: { position: true } });
      const position = (max._max.position ?? 0) + 1;
      if (position > MAX_ASSESSMENT_QUESTIONS) {
        throw new BadRequestException(`Đề vượt quá ${MAX_ASSESSMENT_QUESTIONS} câu`);
      }
      const created = await tx.question.create({
        data: {
          assessmentId,
          type: dto.type,
          position,
          prompt,
          payload: dto.payload as Prisma.InputJsonValue,
          points: dto.points,
        },
      });
      return toTeacherQuestionDto(created);
    });
  }

  async update(
    assessmentId: string,
    questionId: string,
    dto: UpdateQuestionDto,
    actor: AssessmentActor,
  ): Promise<TeacherQuestionDto> {
    const prompt = dto.prompt !== undefined ? dto.prompt.trim() : undefined;
    if (prompt !== undefined && !prompt) {
      throw new BadRequestException('Nội dung câu hỏi không được để trống');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockEditable(tx, assessmentId, actor);
      const existing = await tx.question.findUnique({ where: { id: questionId } });
      if (!existing || existing.assessmentId !== assessmentId) {
        throw new NotFoundException('Không tìm thấy câu hỏi');
      }
      const payload = (dto.payload ?? existing.payload) as Record<string, unknown>;
      this.schemaPolicy.validatePayload(existing.type, payload);
      await this.assertMediaOwned(tx, assessmentId, existing.type, payload);
      const nextNeedsReview =
        dto.needsReview !== undefined
          ? dto.needsReview
          : dto.payload !== undefined
            ? false
            : existing.needsReview;
      const updated = await tx.question.update({
        where: { id: questionId },
        data: {
          ...(prompt !== undefined ? { prompt } : {}),
          ...(dto.payload !== undefined ? { payload: dto.payload as Prisma.InputJsonValue } : {}),
          ...(dto.points !== undefined ? { points: dto.points } : {}),
          needsReview: nextNeedsReview,
        },
      });
      return toTeacherQuestionDto(updated);
    });
  }

  async remove(assessmentId: string, questionId: string, actor: AssessmentActor): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockEditable(tx, assessmentId, actor);
      const existing = await tx.question.findUnique({ where: { id: questionId } });
      if (!existing || existing.assessmentId !== assessmentId) {
        throw new NotFoundException('Không tìm thấy câu hỏi');
      }
      await tx.question.delete({ where: { id: questionId } });
      // Two-step shift avoids unique constraint collisions on (assessmentId, position) in PostgreSQL.
      await tx.question.updateMany({
        where: { assessmentId, position: { gt: existing.position } },
        data: { position: { increment: 10000 } },
      });
      await tx.question.updateMany({
        where: { assessmentId, position: { gt: existing.position + 10000 } },
        data: { position: { decrement: 10001 } },
      });
    });
  }

  async reorder(assessmentId: string, dto: ReorderQuestionsDto, actor: AssessmentActor): Promise<TeacherQuestionDto[]> {
    if (new Set(dto.questionIds).size !== dto.questionIds.length) {
      throw new BadRequestException('Danh sách câu hỏi không được chứa id trùng lặp');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockEditable(tx, assessmentId, actor);
      const existing = await tx.question.findMany({ where: { assessmentId } });
      const ids = new Set(existing.map((q) => q.id));
      if (dto.questionIds.length !== existing.length || dto.questionIds.some((id) => !ids.has(id))) {
        throw new NotFoundException('Danh sách câu hỏi không khớp với đề');
      }
      await tx.question.updateMany({ where: { assessmentId }, data: { position: { increment: 10000 } } });
      if (dto.questionIds.length > 0) {
        if (typeof tx.$executeRaw === 'function') {
          const pairs = dto.questionIds.map((id, idx) => Prisma.sql`(${id}, ${idx + 1}::int)`);
          await tx.$executeRaw`
            UPDATE "questions" AS q
            SET "position" = v."pos"
            FROM (VALUES ${Prisma.join(pairs)}) AS v("id", "pos")
            WHERE q."id" = v."id" AND q."assessment_id" = ${assessmentId}
          `;
        } else {
          for (let i = 0; i < dto.questionIds.length; i += 1) {
            await tx.question.update({ where: { id: dto.questionIds[i]! }, data: { position: i + 1 } });
          }
        }
      }
      const rows = await tx.question.findMany({ where: { assessmentId }, ...byPosition });
      return rows.map(toTeacherQuestionDto);
    });
  }

  private async lockEditable(tx: Prisma.TransactionClient, assessmentId: string, actor: AssessmentActor) {
    await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${assessmentId} FOR UPDATE`;
    const assessment = await tx.assessment.findUnique({ where: { id: assessmentId } });
    assertEditableAssessment(actor, assessment);
  }

  private async assertMediaOwned(
    tx: Prisma.TransactionClient,
    assessmentId: string,
    type: Parameters<typeof collectRequiredMedia>[0],
    payload: unknown,
  ): Promise<void> {
    const reqs = collectRequiredMedia(type, payload);
    if (reqs.length === 0) return;
    assertValidMediaUuids(reqs);
    const rows = await tx.mediaAsset.findMany({
      where: { assessmentId, id: { in: reqs.map((r) => r.id) } },
      select: { id: true, kind: true },
    });
    if (rows.length !== reqs.length) {
      throw new BadRequestException('mediaId không thuộc đề này');
    }
    const kindById = new Map(rows.map((r) => [r.id, r.kind]));
    for (const req of reqs) {
      const actual = kindById.get(req.id);
      if (actual && actual !== req.kind) {
        throw new BadRequestException('Loại file media không phù hợp với dạng câu hỏi');
      }
    }
  }
}
