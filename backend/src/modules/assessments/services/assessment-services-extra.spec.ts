import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, AssessmentType, MediaKind, QuestionType, Role } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionSchemaPolicy } from '../policies/question-schema.policy.js';
import { AssessmentCrudService } from './assessment-crud.service.js';
import { persistMediaBytes, readStoredFile } from './document-extract.js';
import { QuestionCrudService } from './question-crud.service.js';

const owner = { id: 'teacher-1', roles: [Role.TEACHER] };
const schemaPolicy = new QuestionSchemaPolicy();
const baseRow = {
  id: 'asm-1',
  title: 'Đề 100%',
  description: null,
  type: AssessmentType.HOMEWORK,
  courseId: 'c-1',
  durationMinutes: 45,
  status: AssessmentStatus.DRAFT,
  isLocked: false,
  originalFileName: null as string | null,
  originalStorageKey: null as string | null,
  createdById: 'teacher-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { fullName: 'Cô Lan' },
  questions: [],
};

function makeFullPrisma(overrides: Partial<Record<string, unknown>> = {}) {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    assessment: {
      findUnique: vi.fn(async () => baseRow),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ ...baseRow, id: 'asm-copy', ...a.data })),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => ({ ...baseRow, ...a.data })),
      delete: vi.fn(async () => baseRow),
    },
    mediaAsset: {
      findMany: vi.fn(async () => []),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'm-new', ...a.data })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    questionMedia: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    question: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _max: { position: 0 } })),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'q-1', ...a.data, needsReview: false })),
      createMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'q-1', ...a.data, position: 1, type: QuestionType.ESSAY, prompt: 'P', payload: {}, points: 1, needsReview: false })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      delete: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
  };
  return {
    course: { findUnique: vi.fn(async () => ({ id: 'c-1' })) },
    assessment: {
      ...tx.assessment,
      findMany: vi.fn(async () => [{ ...baseRow, questions: [{ points: 2 }] }]),
      count: vi.fn(async () => 1),
    },
    mediaAsset: { ...tx.mediaAsset, findUnique: vi.fn(async () => null) },
    question: tx.question,
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    tx,
    ...overrides,
  };
}

describe('Assessment & Question services extended coverage', () => {
  const dirs: string[] = [];
  const prevUploadDir = process.env.UPLOAD_DIR;

  afterEach(() => {
    if (prevUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = prevUploadDir;
    while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
  });

  it('covers create, escapeLike search, update, and publish guards on AssessmentCrudService', async () => {
    const prisma = makeFullPrisma();
    const svc = new AssessmentCrudService(prisma as never, schemaPolicy);

    await expect(svc.create({ title: '  ', type: AssessmentType.HOMEWORK, courseId: 'c-1' }, owner.id)).rejects.toThrow(BadRequestException);
    prisma.course.findUnique.mockResolvedValueOnce(null as never);
    await expect(svc.create({ title: 'OK', type: AssessmentType.HOMEWORK, courseId: 'c-1' }, owner.id)).rejects.toThrow(NotFoundException);

    const created = await svc.create({ title: ' Đề mới ', description: '  ', type: AssessmentType.HOMEWORK, courseId: 'c-1' }, owner.id);
    expect(created.id).toBe('asm-copy');

    await svc.list({ search: '100% _', type: AssessmentType.HOMEWORK, courseId: 'c-1', status: AssessmentStatus.DRAFT }, owner);
    expect(prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ title: { contains: '100\\% \\_', mode: 'insensitive' } }),
          ]),
        }),
      }),
    );

    await expect(svc.getDetail('asm-1', owner)).resolves.toMatchObject({ id: 'asm-1' });
    await expect(svc.update('asm-1', { title: '   ' }, owner)).rejects.toThrow(BadRequestException);
    await expect(svc.update('asm-1', { title: 'Tên mới', durationMinutes: 30 }, owner)).resolves.toMatchObject({ title: 'Tên mới' });

    await expect(svc.publish('asm-1', owner)).rejects.toThrow(BadRequestException);
    prisma.tx.assessment.findUnique.mockResolvedValueOnce({ ...baseRow, status: AssessmentStatus.PUBLISHED } as never);
    await expect(svc.publish('asm-1', owner)).rejects.toThrow(ConflictException);
    prisma.tx.assessment.findUnique.mockResolvedValueOnce({
      ...baseRow,
      questions: [{ id: 'q-1', type: QuestionType.ESSAY, payload: { rubric: 'Đúng ngữ pháp' }, needsReview: false }],
    } as never);
    await expect(svc.publish('asm-1', owner)).resolves.toMatchObject({ status: AssessmentStatus.PUBLISHED });
  });

  it('covers remove disk cleanup, duplicate media clone/rollback, uploadMedia rollback, and streams', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'webedu-svc-'));
    dirs.push(dir);
    process.env.UPLOAD_DIR = dir;

    const audioKey = await persistMediaBytes(Buffer.from('ID3data'), 'audio/mpeg');
    const origKey = await persistMediaBytes(Buffer.from('PDF'), 'application/pdf');
    const assetId = '11111111-1111-1111-1111-111111111111';

    const prisma = makeFullPrisma();
    prisma.tx.assessment.findUnique.mockResolvedValue({
      ...baseRow,
      originalFileName: 'de.pdf',
      originalStorageKey: origKey,
      questions: [{ type: QuestionType.LISTENING, prompt: 'Nghe', payload: { mediaId: assetId }, points: 1, needsReview: false }],
    } as never);
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: assetId, kind: MediaKind.AUDIO, mime: 'audio/mpeg', sizeBytes: 7, storageKey: audioKey }] as never);

    const svc = new AssessmentCrudService(prisma as never, schemaPolicy);
    await svc.duplicate('asm-1', owner);
    expect(prisma.tx.mediaAsset.create).toHaveBeenCalled();

    prisma.tx.assessment.findUnique.mockResolvedValueOnce({ ...baseRow, status: AssessmentStatus.PUBLISHED } as never);
    await expect(svc.remove('asm-1', owner)).rejects.toThrow(ConflictException);

    await svc.remove('asm-1', owner);
    await expect(readStoredFile(audioKey)).resolves.toBeNull();
    await expect(readStoredFile(origKey)).resolves.toBeNull();

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await expect(svc.uploadMedia('asm-1', 'bad.pdf', Buffer.from('%PDF-1.4'), owner)).rejects.toThrow(BadRequestException);
    await expect(svc.uploadMedia('asm-1', 'ok.png', png, owner)).resolves.toMatchObject({ kind: MediaKind.IMAGE });
    await expect(svc.uploadMedia('asm-1', 'ok.mp3', Buffer.from('ID3data'), owner)).resolves.toMatchObject({ kind: MediaKind.AUDIO });
    prisma.tx.assessment.findUnique.mockResolvedValueOnce(null as never);
    await expect(svc.uploadMedia('asm-1', 'pic.png', png, owner)).rejects.toThrow(NotFoundException);

    const imgKey = await persistMediaBytes(png, 'image/png');
    prisma.assessment.findUnique.mockResolvedValue({ ...baseRow, originalFileName: 'Đề gốc.pdf', originalStorageKey: imgKey } as never);
    await expect(svc.streamOriginal('asm-1', owner)).resolves.toBeDefined();
    prisma.assessment.findUnique.mockResolvedValueOnce({ ...baseRow, originalFileName: null, originalStorageKey: null } as never);
    await expect(svc.streamOriginal('asm-1', owner)).rejects.toThrow(NotFoundException);
    prisma.assessment.findUnique.mockResolvedValueOnce({ ...baseRow, originalFileName: 'missing.pdf', originalStorageKey: 'uploads/media/missing.pdf' } as never);
    await expect(svc.streamOriginal('asm-1', owner)).rejects.toThrow(NotFoundException);

    prisma.mediaAsset.findUnique.mockResolvedValueOnce(null as never);
    await expect(svc.streamMedia('asm-1', assetId, owner)).rejects.toThrow(NotFoundException);
    prisma.mediaAsset.findUnique.mockResolvedValue({ id: assetId, assessmentId: null, storageKey: imgKey } as never);
    prisma.question.findMany.mockResolvedValue([{ payload: { options: [{ imageMediaId: assetId }] } }] as never);
    await expect(svc.streamMedia('asm-1', assetId, owner)).resolves.toBeDefined();

    prisma.question.findMany.mockResolvedValueOnce([{ payload: {} }] as never);
    await expect(svc.streamMedia('asm-1', assetId, owner)).rejects.toThrow(NotFoundException);
    prisma.mediaAsset.findUnique.mockResolvedValueOnce({ id: assetId, assessmentId: 'other', storageKey: imgKey } as never);
    await expect(svc.streamMedia('asm-1', assetId, owner)).rejects.toThrow(NotFoundException);

    const dupKey = await persistMediaBytes(png, 'image/png');
    prisma.assessment.findUnique.mockResolvedValueOnce({ ...baseRow, originalStorageKey: dupKey, originalFileName: 'x.png', questions: [] } as never);
    prisma.mediaAsset.findMany.mockResolvedValueOnce([]);
    prisma.$transaction.mockRejectedValueOnce(new Error('dup rollback'));
    await expect(svc.duplicate('asm-1', owner)).rejects.toThrow('dup rollback');
  });

  it('covers QuestionCrudService add/update/remove/reorder and kind mismatches', async () => {
    const audioId = '11111111-1111-1111-1111-111111111111';
    const imgId = '22222222-2222-2222-2222-222222222222';
    const prisma = makeFullPrisma();
    const svc = new QuestionCrudService(prisma as never, schemaPolicy);

    await expect(svc.add('asm-1', { type: QuestionType.ESSAY, prompt: '   ', payload: {}, points: 1 }, owner)).rejects.toThrow(BadRequestException);
    prisma.tx.mediaAsset.findMany.mockResolvedValueOnce([{ id: audioId, kind: MediaKind.IMAGE }] as never);
    await expect(svc.add('asm-1', { type: QuestionType.LISTENING, prompt: 'Nghe', payload: { mediaId: audioId }, points: 1 }, owner)).rejects.toThrow(BadRequestException);
    prisma.tx.mediaAsset.findMany.mockResolvedValueOnce([{ id: imgId, kind: MediaKind.IMAGE }] as never);
    await expect(svc.add('asm-1', { type: QuestionType.IMAGE_BASED, prompt: 'Nhìn', payload: { mediaId: imgId, options: [], correctOptionIds: [] }, points: 1 }, owner)).resolves.toMatchObject({ id: 'q-1' });

    await expect(svc.update('asm-1', 'q-1', { prompt: '  ' }, owner)).rejects.toThrow(BadRequestException);
    await expect(svc.update('asm-1', 'q-missing', { prompt: 'OK' }, owner)).rejects.toThrow(NotFoundException);
    prisma.tx.question.findUnique.mockResolvedValueOnce({ id: 'q-1', assessmentId: 'asm-1', type: QuestionType.ESSAY, payload: {} } as never);
    await expect(svc.update('asm-1', 'q-1', { prompt: 'Sửa', payload: { rubric: 'Tốt' }, points: 2 }, owner)).resolves.toMatchObject({ id: 'q-1' });

    await expect(svc.remove('asm-1', 'q-missing', owner)).rejects.toThrow(NotFoundException);
    prisma.tx.question.findUnique.mockResolvedValueOnce({ id: 'q-1', assessmentId: 'asm-1' } as never);
    prisma.tx.question.findMany.mockResolvedValueOnce([{ id: 'q-2' }] as never);
    await expect(svc.remove('asm-1', 'q-1', owner)).resolves.toBeUndefined();

    await expect(svc.reorder('asm-1', { questionIds: [audioId, audioId] }, owner)).rejects.toThrow(BadRequestException);
    prisma.tx.question.findMany.mockResolvedValueOnce([{ id: audioId }] as never);
    await expect(svc.reorder('asm-1', { questionIds: [imgId] }, owner)).rejects.toThrow(NotFoundException);
  });
});
