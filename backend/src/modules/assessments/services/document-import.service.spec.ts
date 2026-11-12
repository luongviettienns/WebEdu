import { BadRequestException } from '@nestjs/common';
import { AssessmentType } from '@prisma/client';
import { vi } from 'vitest';
import { DocumentImportService } from './document-import.service.js';

const DOCX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
const PDF_MAGIC = Buffer.from('%PDF-1.4 mock');

const THREE_QUESTIONS = `Câu 1. 你好吗？
A. 我很好
B. 我是学生
C. 谢谢
D. 再见
Đáp án: A

Câu 2. 你叫什么名字？
A. 我叫小明
B. 我很好
C. 对不起
Đáp án: A

Câu 3. 今天星期几？
A. 星期一
B. 现在
C. 明天
`;

describe('DocumentImportService (Task 5.3 TDD)', () => {
  function makePrisma(createdQuestions: Array<{ id: string }> = []) {
    const tx = {
      assessment: {
        create: vi.fn(async () => ({ id: 'asm-imp-1' })),
      },
      question: {
        create: vi.fn(async () => {
          const row = { id: `q-${createdQuestions.length + 1}` };
          createdQuestions.push(row);
          return row;
        }),
      },
      mediaAsset: { create: vi.fn(async () => ({ id: 'media-1' })) },
      questionMedia: { create: vi.fn(async () => ({})) },
    };
    return {
      course: { findUnique: vi.fn(async () => ({ id: 'course-1' })) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      tx,
    };
  }

  const dto = { courseId: 'course-1', type: AssessmentType.HOMEWORK };

  it('rejects legacy .doc uploads', async () => {
    const prisma = makePrisma();
    const service = new DocumentImportService(prisma as never);
    await expect(
      service.importFile('teacher-1', 'de.doc', Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), dto),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a PDF with no text layer', async () => {
    const prisma = makePrisma();
    const service = new DocumentImportService(prisma as never);
    service.extractors = {
      extractDocx: vi.fn(),
      extractPdf: vi.fn(async () => ({ text: '   ', images: [] })),
      persistBytes: vi.fn(),
    };
    await expect(service.importFile('teacher-1', 'de.pdf', PDF_MAGIC, dto)).rejects.toMatchObject({
      message: expect.stringContaining('scan'),
    });
  });

  it('creates three DRAFT questions and flags the one without an answer', async () => {
    const created: Array<{ id: string }> = [];
    const prisma = makePrisma(created);
    const service = new DocumentImportService(prisma as never);
    service.extractors = {
      extractDocx: vi.fn(async () => ({ text: THREE_QUESTIONS, images: [] })),
      extractPdf: vi.fn(),
      persistBytes: vi.fn(),
    };
    const result = await service.importFile('teacher-1', 'de.docx', DOCX_MAGIC, dto);
    expect(result).toEqual({
      assessmentId: 'asm-imp-1',
      recognizedCount: 3,
      needsReviewCount: 1,
      summary: 'Nhận diện 3 câu; 1 câu cần kiểm tra',
    });
    expect(prisma.tx.question.create).toHaveBeenCalledTimes(3);
    expect(prisma.tx.question.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ data: expect.objectContaining({ needsReview: true }) }),
    );
  });

  it('stores an embedded image as MediaAsset on the first question', async () => {
    const created: Array<{ id: string }> = [];
    const prisma = makePrisma(created);
    const service = new DocumentImportService(prisma as never);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
    service.extractors = {
      extractDocx: vi.fn(async () => ({
        text: THREE_QUESTIONS,
        images: [{ mime: 'image/png', bytes: png }],
      })),
      extractPdf: vi.fn(),
      persistBytes: vi.fn(async () => 'uploads/media/test.png'),
    };
    await service.importFile('teacher-1', 'de.docx', DOCX_MAGIC, dto);
    expect(prisma.tx.mediaAsset.create).toHaveBeenCalledTimes(1);
    expect(prisma.tx.questionMedia.create).toHaveBeenCalledWith({
      data: { questionId: 'q-1', mediaAssetId: 'media-1', role: 'stem' },
    });
  });
});
