import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { assertSafeUpload } from '../policies/media-upload.policy.js';
import {
  parseImportedQuestions,
  type ExtractedImage,
  type ParsedDraftQuestion,
} from '../policies/document-import.parser.js';
import { toTeacherAssessmentDto } from '../mappers/assessment.mapper.js';
import { extractDocx, extractPdf, persistMediaBytes } from './document-extract.js';
import type { ImportAssessmentDto } from '../dto/import.dto.js';
import type { TeacherAssessmentDto } from '../assessments.types.js';

const QUESTIONS_ORDERED = { orderBy: { position: 'asc' as const } };

export type ImportResult = {
  assessmentId: string;
  recognizedCount: number;
  needsReviewCount: number;
  summary: string;
};

export type DocumentExtractors = {
  extractDocx: (buffer: Buffer) => Promise<{ text: string; images: ExtractedImage[] }>;
  extractPdf: (buffer: Buffer) => Promise<{ text: string; images: ExtractedImage[] }>;
  persistBytes: (bytes: Buffer, mime: string) => Promise<string>;
};

const defaultExtractors: DocumentExtractors = {
  extractDocx,
  extractPdf,
  persistBytes: persistMediaBytes,
};

@Injectable()
export class DocumentImportService {
  extractors: DocumentExtractors = defaultExtractors;

  constructor(private readonly prisma: PrismaService) {}

  async importFile(
    actorId: string,
    filename: string,
    buffer: Buffer,
    dto: ImportAssessmentDto,
  ): Promise<ImportResult> {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'doc') {
      throw new BadRequestException('Chỉ hỗ trợ file .docx, .pdf tối đa 20MB');
    }
    assertSafeUpload(buffer, filename);

    const extracted = ext === 'pdf' ? await this.extractors.extractPdf(buffer) : await this.extractors.extractDocx(buffer);
    if (!extracted.text.trim()) {
      if (ext === 'pdf') {
        throw new BadRequestException(
          'PDF không có lớp chữ (file scan). Chỉ hỗ trợ .docx và PDF có lớp chữ, tối đa 20MB',
        );
      }
      throw new BadRequestException('Không nhận diện được câu hỏi nào');
    }

    const parsed = parseImportedQuestions(extracted.text);
    if (parsed.length === 0) {
      throw new BadRequestException('Không nhận diện được câu hỏi nào');
    }

    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Không tìm thấy khóa học');

    const title = (dto.title?.trim() || filename.replace(/\.[^.]+$/, '')).slice(0, 200);
    return this.prisma.$transaction((tx) =>
      this.persistDraft(tx, {
        actorId,
        title,
        type: dto.type,
        courseId: dto.courseId,
        questions: parsed,
        images: extracted.images,
      }),
    );
  }

  async getReview(id: string): Promise<TeacherAssessmentDto & { recognizedCount: number; needsReviewCount: number; summary: string }> {
    const row = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: QUESTIONS_ORDERED },
    });
    if (!row) throw new NotFoundException('Không tìm thấy đề');
    const dto = toTeacherAssessmentDto(row);
    const needsReviewCount = (dto.questions ?? []).filter((q) => q.needsReview).length;
    return {
      ...dto,
      recognizedCount: dto.questionCount,
      needsReviewCount,
      summary: `Nhận diện ${dto.questionCount} câu; ${needsReviewCount} câu cần kiểm tra`,
    };
  }

  private async persistDraft(
    tx: Prisma.TransactionClient,
    input: {
      actorId: string;
      title: string;
      type: ImportAssessmentDto['type'];
      courseId: string;
      questions: ParsedDraftQuestion[];
      images: ExtractedImage[];
    },
  ): Promise<ImportResult> {
    const assessment = await tx.assessment.create({
      data: {
        title: input.title,
        type: input.type,
        courseId: input.courseId,
        createdById: input.actorId,
      },
    });

    const createdQuestions: Array<{ id: string }> = [];
    for (let i = 0; i < input.questions.length; i += 1) {
      const q = input.questions[i]!;
      const row = await tx.question.create({
        data: {
          assessmentId: assessment.id,
          type: q.type,
          position: i + 1,
          prompt: q.prompt,
          payload: q.payload as Prisma.InputJsonValue,
          points: q.points,
          needsReview: q.needsReview,
        },
      });
      createdQuestions.push(row);
    }

    for (const image of input.images) {
      if (!image.mime.startsWith('image/') || image.bytes.byteLength === 0) continue;
      const storageKey = await this.extractors.persistBytes(image.bytes, image.mime);
      const asset = await tx.mediaAsset.create({
        data: {
          kind: MediaKind.IMAGE,
          mime: image.mime,
          sizeBytes: image.bytes.byteLength,
          storageKey,
        },
      });
      const first = createdQuestions[0];
      if (first) {
        await tx.questionMedia.create({
          data: { questionId: first.id, mediaAssetId: asset.id, role: 'stem' },
        });
      }
    }

    const needsReviewCount = input.questions.filter((q) => q.needsReview).length;
    return {
      assessmentId: assessment.id,
      recognizedCount: input.questions.length,
      needsReviewCount,
      summary: `Nhận diện ${input.questions.length} câu; ${needsReviewCount} câu cần kiểm tra`,
    };
  }
}
