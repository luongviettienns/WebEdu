import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AssessmentType, QuestionType, Role } from '@prisma/client';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, vi } from 'vitest';
import { AssessmentCrudService } from './assessment-crud.service.js';
import { persistMediaBytes } from './document-extract.js';
import { QuestionCrudService } from './question-crud.service.js';
import { QuestionSchemaPolicy } from '../policies/question-schema.policy.js';

const owner = { id: 'teacher-1', roles: [Role.TEACHER] };
const other = { id: 'teacher-2', roles: [Role.TEACHER] };

describe('AssessmentCrudService & QuestionCrudService (Task 5.2 TDD)', () => {
  const schemaPolicy = new QuestionSchemaPolicy();

  function makePrisma(state: Record<string, unknown>) {
    const assessmentFind = vi.fn(async () => state.assessment ?? null);
    const assessmentUpdate = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      ...(state.assessment as object),
      ...args.data,
    }));
    const questionUpdate = vi.fn(async () => ({}));
    const questionUpdateMany = vi.fn(async () => ({ count: 0 }));
    const courseFindUnique = vi.fn(async () => ({ id: 'course-1', isActive: true }));
    const tx = {
      course: { findUnique: courseFindUnique },
      assessment: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'copy-1', ...args.data })),
        findUnique: assessmentFind,
        update: assessmentUpdate,
        delete: vi.fn(async () => ({})),
      },
      question: {
        aggregate: vi.fn(async () => ({ _max: { position: 2 } })),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'q-1', ...args.data })),
        createMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => state.question ?? null),
        findMany: vi.fn(async () => []),
        delete: vi.fn(async () => ({})),
        deleteMany: vi.fn(async () => ({})),
        update: questionUpdate,
        updateMany: questionUpdateMany,
      },
      mediaAsset: {
        findMany: vi.fn(async () => (state.media as unknown[]) ?? []),
        deleteMany: vi.fn(async () => ({})),
      },
      questionMedia: { deleteMany: vi.fn(async () => ({})) },
      $queryRaw: vi.fn(async () => []),
    };
    return {
      course: { findUnique: courseFindUnique },
      assessment: {
        create: tx.assessment.create,
        findUnique: assessmentFind,
        findMany: vi.fn(async () => []),
        count: vi.fn(async () => 0),
        update: assessmentUpdate,
        delete: vi.fn(async () => ({})),
      },
      question: tx.question,
      mediaAsset: tx.mediaAsset,
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      tx,
    };
  }

  const validChoice = {
    options: [
      { id: 'a', text: '你' },
      { id: 'b', text: '我' },
    ],
    correctOptionIds: ['a'],
  };

  const draft = {
    id: 'asm-1',
    createdById: 'teacher-1',
    status: 'DRAFT',
    isLocked: false,
  };

  it('publish is blocked while any question needsReview', async () => {
    const state = {
      assessment: {
        ...draft,
        questions: [{ id: 'q-1', type: QuestionType.SINGLE_CHOICE, payload: validChoice, needsReview: true }],
      },
    };
    const service = new AssessmentCrudService(makePrisma(state) as never, schemaPolicy);
    await expect(service.publish('asm-1', owner)).rejects.toThrow(BadRequestException);
  });

  it('publish rejects a choice question whose payload is invalid', async () => {
    const state = {
      assessment: {
        ...draft,
        questions: [
          { id: 'q-1', type: QuestionType.SINGLE_CHOICE, payload: { options: [], correctOptionIds: [] }, needsReview: false },
        ],
      },
    };
    const service = new AssessmentCrudService(makePrisma(state) as never, schemaPolicy);
    await expect(service.publish('asm-1', owner)).rejects.toThrow(BadRequestException);
  });

  it('other teachers cannot publish someone else\'s assessment', async () => {
    const service = new AssessmentCrudService(
      makePrisma({ assessment: { ...draft, questions: [] } }) as never,
      schemaPolicy,
    );
    await expect(service.publish('asm-1', other)).rejects.toThrow(ForbiddenException);
  });

  it('add question is blocked when assessment isLocked', async () => {
    const state = { assessment: { ...draft, isLocked: true } };
    const service = new QuestionCrudService(makePrisma(state) as never, schemaPolicy);
    await expect(
      service.add('asm-1', { type: QuestionType.FILL_BLANK, prompt: '___', payload: { acceptedAnswers: ['a'] }, points: 1 }, owner),
    ).rejects.toThrow(ConflictException);
  });

  it('other teachers cannot add a question', async () => {
    const service = new QuestionCrudService(makePrisma({ assessment: draft }) as never, schemaPolicy);
    await expect(
      service.add('asm-1', { type: QuestionType.FILL_BLANK, prompt: '___', payload: { acceptedAnswers: ['a'] }, points: 1 }, other),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects LISTENING when mediaId is not on the assessment', async () => {
    const prisma = makePrisma({ assessment: draft, media: [] });
    const service = new QuestionCrudService(prisma as never, schemaPolicy);
    await expect(
      service.add('asm-1', { type: QuestionType.LISTENING, prompt: 'Nghe', payload: { mediaId: 'missing' }, points: 1 }, owner),
    ).rejects.toThrow(BadRequestException);
  });

  it('update question validates the merged payload', async () => {
    const state = {
      assessment: draft,
      question: { id: 'q-1', assessmentId: 'asm-1', type: QuestionType.SINGLE_CHOICE, payload: validChoice },
    };
    const prisma = makePrisma(state);
    const service = new QuestionCrudService(prisma as never, schemaPolicy);
    await expect(
      service.update('asm-1', 'q-1', { payload: { options: [], correctOptionIds: [] } }, owner),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.tx.question.update).not.toHaveBeenCalled();
  });

  it('update question preserves needsReview on prompt/points-only edits and clears on payload or explicit needsReview: false', async () => {
    const state = {
      assessment: draft,
      question: { id: 'q-1', assessmentId: 'asm-1', type: QuestionType.SINGLE_CHOICE, payload: validChoice, needsReview: true },
    };
    const prisma = makePrisma(state);
    prisma.tx.question.update.mockImplementation((async (args: { data: Record<string, unknown> }) => ({
      id: 'q-1',
      type: QuestionType.SINGLE_CHOICE,
      position: 1,
      prompt: '你好吗？',
      payload: validChoice,
      points: 1,
      needsReview: true,
      ...args.data,
    })) as never);
    const service = new QuestionCrudService(prisma as never, schemaPolicy);

    const promptOnly = await service.update('asm-1', 'q-1', { prompt: '你好吗？' }, owner);
    expect(promptOnly.needsReview).toBe(true);
    expect(prisma.tx.question.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ prompt: '你好吗？', needsReview: true }) }),
    );

    const pointsOnly = await service.update('asm-1', 'q-1', { points: 2 }, owner);
    expect(pointsOnly.needsReview).toBe(true);
    expect(prisma.tx.question.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ points: 2, needsReview: true }) }),
    );

    const payloadEdited = await service.update('asm-1', 'q-1', { payload: validChoice }, owner);
    expect(payloadEdited.needsReview).toBe(false);
    expect(prisma.tx.question.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ needsReview: false }) }),
    );

    const confirmed = await service.update('asm-1', 'q-1', { needsReview: false } as never, owner);
    expect(confirmed.needsReview).toBe(false);
    expect(prisma.tx.question.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ needsReview: false }) }),
    );
  });

  it('update question rejects clearing needsReview: false when payload is invalid', async () => {
    const invalidChoice = {
      options: [
        { id: 'a', text: '你' },
        { id: 'b', text: '我' },
      ],
      correctOptionIds: [],
    };
    const prisma = makePrisma({
      assessment: draft,
      question: { id: 'q-1', assessmentId: 'asm-1', type: QuestionType.SINGLE_CHOICE, payload: invalidChoice, needsReview: true },
    });
    const service = new QuestionCrudService(prisma as never, schemaPolicy);
    await expect(service.update('asm-1', 'q-1', { needsReview: false } as never, owner)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.tx.question.update).not.toHaveBeenCalled();
  });

  it('rejects create on inactive course (isActive: false) inside FOR SHARE transaction', async () => {
    const prisma = makePrisma({});
    prisma.course.findUnique.mockResolvedValueOnce({ id: 'course-1', isActive: false });
    const service = new AssessmentCrudService(prisma as never, schemaPolicy);
    await expect(
      service.create({ title: 'Đề mới', type: AssessmentType.HOMEWORK, courseId: 'course-1' }, owner.id),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Khóa học HSK hiện đang ngừng hoạt động',
    });
    expect(prisma.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.tx.assessment.create).not.toHaveBeenCalled();
  });

  describe('streamMedia Content-Type integrity', () => {
    const dirs: string[] = [];
    const prevUploadDir = process.env.UPLOAD_DIR;

    afterEach(() => {
      if (prevUploadDir === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = prevUploadDir;
      while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
    });

    it('uses verified MediaAsset.mime instead of filename extension guessing when streaming media', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'webedu-stream-'));
      dirs.push(dir);
      process.env.UPLOAD_DIR = dir;

      const storageKey = await persistMediaBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), 'application/octet-stream');
      expect(storageKey.endsWith('.bin')).toBe(true);

      const prisma = makePrisma({ assessment: draft });
      (prisma.mediaAsset as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique = vi.fn(async () => ({
        id: 'm-1',
        assessmentId: 'asm-1',
        mime: 'image/png',
        storageKey,
      }));
      const service = new AssessmentCrudService(prisma as never, schemaPolicy);
      const streamed = await service.streamMedia('asm-1', 'm-1', owner);
      expect(streamed.getHeaders().type).toBe('image/png');
    });
  });

  it('reorder shifts positions out of the unique range before writing finals', async () => {
    const questions = [
      { id: 'q-a', assessmentId: 'asm-1', position: 1 },
      { id: 'q-b', assessmentId: 'asm-1', position: 2 },
    ];
    const prisma = makePrisma({ assessment: draft });
    prisma.tx.question.findMany.mockImplementation(async () => questions as never);
    const service = new QuestionCrudService(prisma as never, schemaPolicy);
    await service.reorder('asm-1', { questionIds: ['q-b', 'q-a'] }, owner);
    expect(prisma.tx.question.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { position: { increment: 10000 } } }),
    );
  });

  it('lists media belonging to the assessment', async () => {
    const prisma = makePrisma({ assessment: draft });
    prisma.mediaAsset.findMany.mockResolvedValue([{ id: 'm1', kind: 'AUDIO', mime: 'audio/mpeg' }] as never);
    const service = new AssessmentCrudService(prisma as never, schemaPolicy);
    await expect(service.listMedia('asm-1', owner)).resolves.toEqual([
      { id: 'm1', kind: 'AUDIO', mime: 'audio/mpeg' },
    ]);
  });

  it('hides another teacher\'s draft on getDetail', async () => {
    const service = new AssessmentCrudService(makePrisma({ assessment: draft }) as never, schemaPolicy);
    await expect(service.getDetail('asm-1', other)).rejects.toThrow(NotFoundException);
  });

  it('paginates the list and scopes it to own drafts plus published papers', async () => {
    const prisma = makePrisma({});
    prisma.assessment.findMany.mockResolvedValue([
      {
        id: 'asm-1',
        title: 'Đề 1',
        description: null,
        type: 'HOMEWORK',
        courseId: 'course-1',
        durationMinutes: null,
        status: 'DRAFT',
        isLocked: false,
        originalFileName: null,
        assignedClassCount: 0,
        createdById: 'teacher-1',
        createdBy: { fullName: 'Lan' },
        updatedAt: new Date(),
        questions: [{ points: 1 }, { points: 2 }],
      },
    ] as never);
    prisma.assessment.count.mockResolvedValue(21 as never);
    const service = new AssessmentCrudService(prisma as never, schemaPolicy);
    const result = await service.list({ page: 2, limit: 20 }, owner);
    expect(result).toMatchObject({ total: 21, page: 2, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.questionCount).toBe(2);
    expect(result.items[0]?.totalPoints).toBe(3);
    expect(prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { OR: [{ createdById: 'teacher-1' }, { status: 'PUBLISHED' }] },
          ]),
        }),
      }),
    );
  });
});
