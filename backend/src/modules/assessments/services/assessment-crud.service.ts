import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  StreamableFile,
} from '@nestjs/common';
import { AssessmentStatus, MediaKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import {
  assertActiveCourseWithShareLockInTx,
  assertCanMutateAssessment,
  assertCanViewAssessment,
  assertEditableAssessment,
  listVisibilityWhere,
  type AssessmentActor,
} from '../policies/assessment-access.policy.js';
import { QuestionSchemaPolicy } from '../policies/question-schema.policy.js';
import { assertSafeUpload } from '../policies/media-upload.policy.js';
import {
  cloneAssessmentFiles,
  persistMediaBytes,
  unlinkStoredFile,
} from './document-extract.js';
import { remapPayloadMediaIds } from '../policies/payload-media.util.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import { toTeacherAssessmentDto } from '../mappers/assessment.mapper.js';
import { AssessmentMediaAccessService } from './assessment-media-access.service.js';
import type { AssessmentListResult, TeacherAssessmentDto } from '../assessments.types.js';
import type {
  CreateAssessmentDto,
  ListAssessmentsQueryDto,
  UpdateAssessmentDto,
} from '../dto/assessments.dto.js';

const QUESTIONS_ORDERED = { orderBy: { position: 'asc' as const } };
const WITH_AUTHOR = {
  createdBy: { select: { fullName: true } },
  _count: { select: { classAssignments: true } },
};

@Injectable()
export class AssessmentCrudService {
  private readonly mediaAccess: AssessmentMediaAccessService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schemaPolicy: QuestionSchemaPolicy,
    @Optional() mediaAccess?: AssessmentMediaAccessService,
  ) {
    this.mediaAccess = mediaAccess ?? new AssessmentMediaAccessService(prisma);
  }

  async create(dto: CreateAssessmentDto, actorId: string): Promise<TeacherAssessmentDto> {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Tên đề không được để trống');
    const created = await this.prisma.$transaction(async (tx) => {
      await assertActiveCourseWithShareLockInTx(tx, dto.courseId);
      return tx.assessment.create({
        data: {
          title,
          description: dto.description?.trim() || null,
          type: dto.type,
          courseId: dto.courseId,
          durationMinutes: dto.durationMinutes ?? null,
          createdById: actorId,
        },
        include: { questions: QUESTIONS_ORDERED, ...WITH_AUTHOR },
      });
    });
    return toTeacherAssessmentDto(created);
  }

  async list(query: ListAssessmentsQueryDto, actor: AssessmentActor): Promise<AssessmentListResult> {
    const search = query.search?.trim();
    const { page, limit, skip } = resolvePagination(query);
    const where: Prisma.AssessmentWhereInput = {
      AND: [
        listVisibilityWhere(actor),
        {
          ...(query.type ? { type: query.type } : {}),
          ...(query.courseId ? { courseId: query.courseId } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(search ? { title: { contains: escapeLike(search), mode: 'insensitive' } } : {}),
        },
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.assessment.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: { questions: { select: { points: true } }, ...WITH_AUTHOR },
      }),
      this.prisma.assessment.count({ where }),
    ]);
    return {
      items: rows.map((a) => {
        const dto = toTeacherAssessmentDto({ ...a, questions: [] });
        dto.totalPoints = a.questions.reduce((sum, q) => sum + q.points, 0);
        dto.questionCount = a.questions.length;
        return dto;
      }),
      total,
      page,
      limit,
    };
  }

  async getDetail(id: string, actor: AssessmentActor): Promise<TeacherAssessmentDto> {
    const row = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: QUESTIONS_ORDERED, ...WITH_AUTHOR },
    });
    assertCanViewAssessment(actor, row);
    return toTeacherAssessmentDto(row);
  }

  async update(id: string, dto: UpdateAssessmentDto, actor: AssessmentActor): Promise<TeacherAssessmentDto> {
    const title = dto.title !== undefined ? dto.title.trim() : undefined;
    if (title !== undefined && !title) throw new BadRequestException('Tên đề không được để trống');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.assessment.findUnique({ where: { id } });
      assertEditableAssessment(actor, existing);
      const updated = await tx.assessment.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
          ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
        },
        include: { questions: QUESTIONS_ORDERED, ...WITH_AUTHOR },
      });
      return toTeacherAssessmentDto(updated);
    });
  }

  async remove(id: string, actor: AssessmentActor): Promise<void> {
    const keysToUnlink = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.assessment.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Không tìm thấy đề');
      assertCanMutateAssessment(actor, existing.createdById);
      if (existing.status === AssessmentStatus.PUBLISHED || existing.isLocked) {
        throw new ConflictException('Đề đã phát hành, chỉ được nhân bản bản mới');
      }
      const assets = await tx.mediaAsset.findMany({ where: { assessmentId: id }, select: { storageKey: true } });
      await tx.questionMedia.deleteMany({ where: { question: { assessmentId: id } } });
      await tx.mediaAsset.deleteMany({ where: { assessmentId: id } });
      await tx.question.deleteMany({ where: { assessmentId: id } });
      await tx.assessment.delete({ where: { id } });
      const keys = assets.map((m) => m.storageKey);
      if (existing.originalStorageKey) keys.push(existing.originalStorageKey);
      return keys;
    });
    await Promise.all(keysToUnlink.map(unlinkStoredFile));
  }

  async duplicate(id: string, actor: AssessmentActor): Promise<TeacherAssessmentDto> {
    const source = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: QUESTIONS_ORDERED },
    });
    assertCanViewAssessment(actor, source);
    const sourceAssets = await this.prisma.mediaAsset.findMany({ where: { assessmentId: id }, orderBy: { createdAt: 'asc' } });
    const { copiedKeys, originalKey, clonedAssets } = await cloneAssessmentFiles(source.originalStorageKey, sourceAssets);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${id} FOR SHARE`;
        const fresh = await tx.assessment.findUnique({ where: { id }, include: { questions: QUESTIONS_ORDERED } });
        assertCanViewAssessment(actor, fresh);
        const copy = await tx.assessment.create({
          data: {
            title: `${fresh.title} (bản sao)`,
            description: fresh.description,
            type: fresh.type,
            courseId: fresh.courseId,
            durationMinutes: fresh.durationMinutes,
            originalFileName: originalKey ? fresh.originalFileName : null,
            originalStorageKey: originalKey,
            createdById: actor.id,
          },
        });
        const idMap = new Map<string, string>();
        for (const { asset, destKey } of clonedAssets) {
          const created = await tx.mediaAsset.create({
            data: { kind: asset.kind, mime: asset.mime, sizeBytes: asset.sizeBytes, storageKey: destKey, assessmentId: copy.id },
          });
          idMap.set(asset.id, created.id);
        }
        if (fresh.questions.length > 0) {
          await tx.question.createMany({
            data: fresh.questions.map((q, i) => ({
              assessmentId: copy.id,
              type: q.type,
              position: i + 1,
              prompt: q.prompt,
              payload: remapPayloadMediaIds(q.payload, idMap) as Prisma.InputJsonValue,
              points: q.points,
              needsReview: q.needsReview,
            })),
          });
        }
        const full = await tx.assessment.findUnique({ where: { id: copy.id }, include: { questions: QUESTIONS_ORDERED, ...WITH_AUTHOR } });
        return toTeacherAssessmentDto(full!);
      });
    } catch (err) {
      await Promise.all(copiedKeys.map(unlinkStoredFile));
      throw err;
    }
  }

  async publish(id: string, actor: AssessmentActor): Promise<TeacherAssessmentDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.assessment.findUnique({
        where: { id },
        include: { questions: QUESTIONS_ORDERED, ...WITH_AUTHOR },
      });
      if (!existing) throw new NotFoundException('Không tìm thấy đề');
      assertCanMutateAssessment(actor, existing.createdById);
      if (existing.status === AssessmentStatus.PUBLISHED || existing.isLocked) {
        throw new ConflictException('Đề đã được phát hành');
      }
      if (existing.questions.length === 0) {
        throw new BadRequestException('Đề cần ít nhất 1 câu hỏi trước khi phát hành');
      }
      if (existing.questions.some((q) => q.needsReview)) {
        throw new BadRequestException('Còn câu hỏi cần kiểm tra, chưa thể phát hành');
      }
      for (const q of existing.questions) {
        this.schemaPolicy.validatePayload(q.type, q.payload);
        this.assertPublishableEssay(q.type, q.payload);
      }
      const updated = await tx.assessment.update({
        where: { id },
        data: { status: AssessmentStatus.PUBLISHED },
        include: { questions: QUESTIONS_ORDERED, ...WITH_AUTHOR },
      });
      return toTeacherAssessmentDto(updated);
    });
  }

  async uploadMedia(
    assessmentId: string,
    filename: string,
    buffer: Buffer,
    actor: AssessmentActor,
  ): Promise<{ id: string; kind: MediaKind; mime: string }> {
    const { mime } = assertSafeUpload(buffer, filename);
    if (!mime.startsWith('image/') && !mime.startsWith('audio/')) {
      throw new BadRequestException('Chỉ hỗ trợ ảnh hoặc audio');
    }
    const storageKey = await persistMediaBytes(buffer, mime);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "assessments" WHERE id = ${assessmentId} FOR UPDATE`;
        const existing = await tx.assessment.findUnique({ where: { id: assessmentId } });
        assertEditableAssessment(actor, existing);
        const asset = await tx.mediaAsset.create({
          data: {
            kind: mime.startsWith('image/') ? MediaKind.IMAGE : MediaKind.AUDIO,
            mime,
            sizeBytes: buffer.byteLength,
            storageKey,
            assessmentId,
          },
        });
        return { id: asset.id, kind: asset.kind, mime: asset.mime };
      });
    } catch (err) {
      await unlinkStoredFile(storageKey);
      throw err;
    }
  }

  async listMedia(assessmentId: string, actor: AssessmentActor): Promise<Array<{ id: string; kind: MediaKind; mime: string }>> {
    const existing = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    assertCanViewAssessment(actor, existing);
    return this.prisma.mediaAsset.findMany({
      where: { assessmentId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, mime: true },
    });
  }

  async streamOriginal(id: string, actor: AssessmentActor): Promise<StreamableFile> {
    const row = await this.prisma.assessment.findUnique({ where: { id } });
    assertCanViewAssessment(actor, row);
    if (!row.originalStorageKey || !row.originalFileName) {
      throw new NotFoundException('Không có file gốc để tải lại');
    }
    return this.mediaAccess.streamStoredFile(row.originalStorageKey, row.originalFileName, true);
  }

  async streamMedia(assessmentId: string, mediaId: string, actor: AssessmentActor): Promise<StreamableFile> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    assertCanViewAssessment(actor, assessment);
    return this.mediaAccess.streamVerifiedAsset(assessmentId, mediaId);
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

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
