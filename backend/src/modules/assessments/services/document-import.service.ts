import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { assertCanViewAssessment, type AssessmentActor } from '../policies/assessment-access.policy.js';
import { assertSafeDocxZip, assertSafeUpload, detectSafeImageMime } from '../policies/media-upload.policy.js';
import {
  parseImportedQuestions,
  type ExtractedImage,
  type ParsedDraftQuestion,
} from '../policies/document-import.parser.js';
import { toTeacherAssessmentDto } from '../mappers/assessment.mapper.js';
import { extractDocx, extractPdf, persistMediaBytes, unlinkStoredFile } from './document-extract.js';
import type { ImportAssessmentDto } from '../dto/import.dto.js';
import type { TeacherAssessmentDto } from '../assessments.types.js';

const QUESTIONS_ORDERED = { orderBy: { position: 'asc' as const } };
const MAX_IMPORT_QUESTIONS = 200;
const MAX_IMPORT_IMAGES = 30;
const MAX_IMPORT_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTRACT_TIMEOUT_MS = 15_000;
const DECORATION_IMAGE_MIMES = new Set(['image/x-emf', 'image/emf', 'image/x-wmf', 'image/wmf']);

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
    const { mime } = assertSafeUpload(buffer, filename);
    if (ext === 'docx') assertSafeDocxZip(buffer);

    let extracted: { text: string; images: ExtractedImage[] };
    try {
      extracted = await withTimeout(
        ext === 'pdf' ? this.extractors.extractPdf(buffer) : this.extractors.extractDocx(buffer),
        EXTRACT_TIMEOUT_MS,
      );
    } catch (err) {
      rethrowImportError(err);
    }
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
    if (parsed.length > MAX_IMPORT_QUESTIONS) {
      throw new BadRequestException('Đề vượt quá 200 câu');
    }

    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw new NotFoundException('Không tìm thấy khóa học');
    if (course.isActive === false) {
      throw new BadRequestException('Khóa học HSK hiện đang ngừng hoạt động');
    }

    const validatedImages: Array<{ bytes: Buffer; mime: 'image/png' | 'image/jpeg' }> = [];
    for (const image of extracted.images.slice(0, MAX_IMPORT_IMAGES)) {
      if (image.bytes.byteLength === 0) continue;
      if (image.bytes.byteLength > MAX_IMPORT_IMAGE_BYTES) {
        throw new BadRequestException('Ảnh nhúng vượt quá 5MB');
      }
      const verifiedMime = detectSafeImageMime(image.bytes);
      if (!verifiedMime) {
        if (DECORATION_IMAGE_MIMES.has(image.mime.trim().toLowerCase())) continue;
        throw new BadRequestException('Ảnh nhúng trong file đề chỉ hỗ trợ định dạng PNG hoặc JPEG hợp lệ');
      }
      validatedImages.push({ bytes: image.bytes, mime: verifiedMime });
    }

    const title = (dto.title?.trim() || filename.replace(/\.[^.]+$/, '')).slice(0, 200);
    const storedKeys: string[] = [];
    try {
      const originalStorageKey = await this.extractors.persistBytes(buffer, mime);
      storedKeys.push(originalStorageKey);
      const images: Array<ExtractedImage & { storageKey: string }> = [];
      for (const image of validatedImages) {
        const storageKey = await this.extractors.persistBytes(image.bytes, image.mime);
        storedKeys.push(storageKey);
        images.push({ ...image, storageKey });
      }
      return await this.prisma.$transaction(
        (tx) =>
          this.persistDraft(tx, {
            actorId,
            title,
            type: dto.type,
            courseId: dto.courseId,
            originalFileName: filename,
            originalStorageKey,
            questions: parsed,
            images,
          }),
        { timeout: 15_000 },
      );
    } catch (err) {
      await Promise.all(storedKeys.map((key) => unlinkStoredFile(key)));
      throw err;
    }
  }

  async getReview(
    id: string,
    actor: AssessmentActor,
  ): Promise<TeacherAssessmentDto & { recognizedCount: number; needsReviewCount: number; summary: string }> {
    const row = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: QUESTIONS_ORDERED, createdBy: { select: { fullName: true } } },
    });
    assertCanViewAssessment(actor, row);
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
      originalFileName: string;
      originalStorageKey: string;
      questions: ParsedDraftQuestion[];
      images: Array<ExtractedImage & { storageKey: string }>;
    },
  ): Promise<ImportResult> {
    const assessment = await tx.assessment.create({
      data: {
        title: input.title,
        type: input.type,
        courseId: input.courseId,
        createdById: input.actorId,
        originalFileName: input.originalFileName,
        originalStorageKey: input.originalStorageKey,
      },
    });

    await tx.question.createMany({
      data: input.questions.map((q, i) => ({
        assessmentId: assessment.id,
        type: q.type,
        position: i + 1,
        prompt: q.prompt.slice(0, 5000),
        payload: q.payload as Prisma.InputJsonValue,
        points: q.points,
        needsReview: q.needsReview,
      })),
    });

    for (const image of input.images) {
      await tx.mediaAsset.create({
        data: {
          kind: MediaKind.IMAGE,
          mime: image.mime,
          sizeBytes: image.bytes.byteLength,
          storageKey: image.storageKey,
          assessmentId: assessment.id,
        },
      });
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

function rethrowImportError(err: unknown): never {
  if (err instanceof HttpException) throw err;
  throw new BadRequestException('Không đọc được file đề');
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new BadRequestException('File quá phức tạp, vượt thời gian xử lý')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
