import { BadRequestException, HttpStatus } from '@nestjs/common';
import { AssessmentType } from '@prisma/client';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DocumentImportService,
  MAX_CONCURRENT_EXTRACTS,
} from './document-import.service.js';

const DOCX = readFileSync(new URL('../../../../../frontend/e2e/fixtures/sample-questions.docx', import.meta.url));
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
  function makePrisma() {
    const course = { findUnique: vi.fn(async () => ({ id: 'course-1', isActive: true })) };
    const tx = {
      $queryRaw: vi.fn(async () => []),
      course,
      assessment: {
        create: vi.fn(async () => ({ id: 'asm-imp-1' })),
      },
      question: {
        createMany: vi.fn(async () => ({ count: 3 })),
      },
      mediaAsset: { create: vi.fn(async () => ({ id: 'media-1' })) },
    };
    return {
      course,
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

  it('maps a thrown parser error to 400', async () => {
    const prisma = makePrisma();
    const service = new DocumentImportService(prisma as never);
    service.extractors = {
      extractDocx: vi.fn(async () => {
        throw new Error('corrupt zip');
      }),
      extractPdf: vi.fn(),
      persistBytes: vi.fn(),
    };
    await expect(service.importFile('teacher-1', 'de.docx', DOCX, dto)).rejects.toThrow(BadRequestException);
  });

  it('creates three DRAFT questions and flags the one without an answer', async () => {
    const prisma = makePrisma();
    const service = new DocumentImportService(prisma as never);
    const persistBytes = vi.fn(async () => 'uploads/media/orig.docx');
    service.extractors = {
      extractDocx: vi.fn(async () => ({ text: THREE_QUESTIONS, images: [] })),
      extractPdf: vi.fn(),
      persistBytes,
    };
    const result = await service.importFile('teacher-1', 'de.docx', DOCX, dto);
    expect(result).toEqual({
      assessmentId: 'asm-imp-1',
      recognizedCount: 3,
      needsReviewCount: 1,
      summary: 'Nhận diện 3 câu; 1 câu cần kiểm tra',
    });
    expect(persistBytes).toHaveBeenCalledWith(DOCX, expect.any(String));
    expect(prisma.tx.assessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalFileName: 'de.docx',
          originalStorageKey: 'uploads/media/orig.docx',
        }),
      }),
    );
    expect(prisma.tx.question.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ needsReview: true, position: 3 })]),
      }),
    );
  });

  it('stores an embedded image on the assessment, not glued to question 1', async () => {
    const prisma = makePrisma();
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
    await service.importFile('teacher-1', 'de.docx', DOCX, dto);
    expect(prisma.tx.mediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assessmentId: 'asm-imp-1', kind: 'IMAGE' }),
    });
    expect(prisma.tx).not.toHaveProperty('questionMedia');
  });

  it('rejects empty parsed text, non-question text, and rolls back files on transaction error', async () => {
    const prisma = makePrisma();
    const service = new DocumentImportService(prisma as never);
    service.extractors = {
      extractDocx: vi.fn(async () => ({ text: 'Văn bản không đánh số câu', images: [] })),
      extractPdf: vi.fn(),
      persistBytes: vi.fn(async () => 'uploads/media/rollback.docx'),
    };
    await expect(service.importFile('teacher-1', 'none.docx', DOCX, dto)).rejects.toThrow(BadRequestException);

    service.extractors = {
      extractDocx: vi.fn(async () => ({
        text: THREE_QUESTIONS,
        images: [{ mime: 'image/png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }],
      })),
      extractPdf: vi.fn(),
      persistBytes: vi.fn(async () => 'uploads/media/rollback.docx'),
    };
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    await expect(service.importFile('teacher-1', 'fail.docx', DOCX, dto)).rejects.toThrow('db down');

    Object.assign(prisma, {
      assessment: {
        findUnique: vi.fn(async () => ({
          id: 'asm-imp-1',
          title: 'Đề',
          description: null,
          type: AssessmentType.HOMEWORK,
          courseId: 'c-1',
          durationMinutes: null,
          status: 'DRAFT',
          isLocked: false,
          originalFileName: 'de.docx',
          createdById: 'teacher-1',
          updatedAt: new Date(),
          createdBy: { fullName: 'Lan' },
          questions: [{ id: 'q1', type: 'SINGLE_CHOICE', position: 1, prompt: 'P', payload: {}, points: 1, needsReview: true }],
        })),
      },
    });
    const review = await service.getReview('asm-imp-1', { id: 'teacher-1', roles: ['TEACHER' as never] });
    expect(review.needsReviewCount).toBe(1);
    expect(review.summary).toContain('1 câu cần kiểm tra');
  });

  it('rejects import into an inactive course (isActive: false)', async () => {
    const prisma = makePrisma();
    prisma.course.findUnique.mockResolvedValueOnce({ id: 'course-1', isActive: false });
    const persistBytes = vi.fn(async () => 'uploads/media/orig.docx');
    const service = new DocumentImportService(prisma as never);
    service.extractors = {
      extractDocx: vi.fn(async () => ({ text: THREE_QUESTIONS, images: [] })),
      extractPdf: vi.fn(),
      persistBytes,
    };
    await expect(service.importFile('teacher-1', 'de.docx', DOCX, dto)).rejects.toMatchObject({
      status: 400,
      message: 'Khóa học HSK hiện đang ngừng hoạt động',
    });
    expect(persistBytes).not.toHaveBeenCalled();
    expect(prisma.tx.assessment.create).not.toHaveBeenCalled();
  });

  it.each([
    ['image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script /></svg>')],
    ['text/html', Buffer.from('<html><body>xss</body></html>')],
    ['image/png', Buffer.from('not-a-real-png-payload')],
  ])('rejects spoofed/unsafe embedded %s without persisting any media or assessment', async (mime, bytes) => {
    const prisma = makePrisma();
    const persistBytes = vi.fn(async () => 'uploads/media/should-not-write');
    const service = new DocumentImportService(prisma as never);
    service.extractors = {
      extractDocx: vi.fn(async () => ({
        text: THREE_QUESTIONS,
        images: [{ mime, bytes }],
      })),
      extractPdf: vi.fn(),
      persistBytes,
    };
    await expect(service.importFile('teacher-1', 'de.docx', DOCX, dto)).rejects.toMatchObject({
      status: 400,
      message: 'Ảnh nhúng trong file đề chỉ hỗ trợ định dạng PNG hoặc JPEG hợp lệ',
    });
    expect(persistBytes).not.toHaveBeenCalled();
    expect(prisma.tx.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('skips .emf/.wmf decorations safely while persisting verified PNG/JPEG bytes using detected MIME', async () => {
    const prisma = makePrisma();
    const persistBytes = vi.fn(async () => 'uploads/media/asset.jpg');
    const service = new DocumentImportService(prisma as never);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    service.extractors = {
      extractDocx: vi.fn(async () => ({
        text: THREE_QUESTIONS,
        images: [
          { mime: 'image/x-emf', bytes: Buffer.from('emf-decoration') },
          { mime: 'image/wmf', bytes: Buffer.from('wmf-decoration') },
          { mime: 'image/png', bytes: jpeg },
        ],
      })),
      extractPdf: vi.fn(),
      persistBytes,
    };
    await service.importFile('teacher-1', 'de.docx', DOCX, dto);
    expect(persistBytes).toHaveBeenCalledTimes(2);
    expect(persistBytes).toHaveBeenNthCalledWith(2, jpeg, 'image/jpeg');
    expect(prisma.tx.mediaAsset.create).toHaveBeenCalledTimes(1);
    expect(prisma.tx.mediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assessmentId: 'asm-imp-1', kind: 'IMAGE', mime: 'image/jpeg' }),
    });
    expect(prisma.tx).not.toHaveProperty('questionMedia');
  });

  it('re-checks course active status under FOR SHARE inside persistDraft transaction to guard against TOCTOU', async () => {
    const prisma = makePrisma();
    prisma.course.findUnique
      .mockResolvedValueOnce({ id: 'course-1', isActive: true })
      .mockResolvedValueOnce({ id: 'course-1', isActive: false });
    const service = new DocumentImportService(prisma as never);
    service.extractors = {
      extractDocx: vi.fn(async () => ({ text: THREE_QUESTIONS, images: [] })),
      extractPdf: vi.fn(),
      persistBytes: vi.fn(async () => 'uploads/media/orig.docx'),
    };
    await expect(service.importFile('teacher-1', 'de.docx', DOCX, dto)).rejects.toMatchObject({
      status: 400,
      message: 'Khóa học HSK hiện đang ngừng hoạt động',
    });
    expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.tx.assessment.create).not.toHaveBeenCalled();
  });

  it('caps concurrent document extractions at MAX_CONCURRENT_EXTRACTS (2) with 429 and releases slots in finally', async () => {
    expect(MAX_CONCURRENT_EXTRACTS).toBe(2);

    const prisma = makePrisma();
    const service = new DocumentImportService(prisma as never);
    let releaseExtracts!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseExtracts = resolve;
    });

    service.extractors = {
      extractDocx: vi.fn(async () => {
        await gate;
        return { text: THREE_QUESTIONS, images: [] };
      }),
      extractPdf: vi.fn(),
      persistBytes: vi.fn(async () => 'uploads/media/orig.docx'),
    };

    const first = service.importFile('teacher-1', 'd1.docx', DOCX, dto);
    const second = service.importFile('teacher-1', 'd2.docx', DOCX, dto);

    // Wait a microtask so both imports reach extractDocx and hold both active slots
    await Promise.resolve();

    await expect(
      service.importFile('teacher-1', 'd3.docx', DOCX, dto),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message:
        'Hệ thống đang xử lý tối đa số lượng file đề cùng lúc, vui lòng thử lại sau ít giây',
    });

    releaseExtracts();
    await Promise.all([first, second]);

    // Slot released after completion -> subsequent import succeeds
    await expect(
      service.importFile('teacher-1', 'd4.docx', DOCX, dto),
    ).resolves.toMatchObject({ assessmentId: 'asm-imp-1' });
  });
});
