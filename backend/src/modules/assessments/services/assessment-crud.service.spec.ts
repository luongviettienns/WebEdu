import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { vi } from 'vitest';
import { AssessmentCrudService } from './assessment-crud.service.js';
import { QuestionCrudService } from './question-crud.service.js';
import { QuestionSchemaPolicy } from '../policies/question-schema.policy.js';

function txMock(_state: Record<string, unknown>) {
  return {
    assessment: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'copy-1', ...args.data })),
      findUnique: vi.fn(async () => ({
        id: 'copy-1',
        title: 'X (bản sao)',
        questions: [],
        updatedAt: new Date(),
      })),
    },
    question: {
      createMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      delete: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    $queryRaw: vi.fn(async () => []),
  };
}

describe('AssessmentCrudService & QuestionCrudService (Task 5.2 TDD)', () => {
  const schemaPolicy = new QuestionSchemaPolicy();

  function makePrisma(state: Record<string, unknown>) {
    const tx = txMock(state);
    return {
      course: { findUnique: vi.fn(async () => ({ id: 'course-1' })) },
      assessment: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: 'asm-1',
          ...args.data,
          status: 'DRAFT',
          isLocked: false,
          updatedAt: new Date(),
          questions: [],
        })),
        findUnique: vi.fn(async () => (state.assessment ?? null)),
        findMany: vi.fn(async () => []),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          ...(state.assessment as object),
          ...args.data,
        })),
        delete: vi.fn(async () => ({})),
      },
      question: {
        aggregate: vi.fn(async () => ({ _max: { position: 2 } })),
        create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'q-1', ...args.data })),
        findUnique: vi.fn(async () => (state.question ?? null)),
        findMany: vi.fn(async () => []),
        deleteMany: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    };
  }

  const validChoice = {
    options: [
      { id: 'a', text: '你' },
      { id: 'b', text: '我' },
    ],
    correctOptionIds: ['a'],
  };

  it('publish is blocked while any question needsReview', async () => {
    const state = {
      assessment: {
        id: 'asm-1',
        status: 'DRAFT',
        questions: [{ id: 'q-1', type: QuestionType.SINGLE_CHOICE, payload: validChoice, needsReview: true }],
      },
    };
    const service = new AssessmentCrudService(makePrisma(state) as never, schemaPolicy);
    await expect(service.publish('asm-1')).rejects.toThrow(BadRequestException);
  });

  it('publish rejects a choice question whose payload is invalid', async () => {
    const state = {
      assessment: {
        id: 'asm-1',
        status: 'DRAFT',
        questions: [
          { id: 'q-1', type: QuestionType.SINGLE_CHOICE, payload: { options: [], correctOptionIds: [] }, needsReview: false },
        ],
      },
    };
    const service = new AssessmentCrudService(makePrisma(state) as never, schemaPolicy);
    await expect(service.publish('asm-1')).rejects.toThrow(BadRequestException);
  });

  it('add question is forbidden when assessment isLocked', async () => {
    const state = { assessment: { id: 'asm-1', isLocked: true } };
    const service = new QuestionCrudService(makePrisma(state) as never, schemaPolicy);
    await expect(
      service.add('asm-1', { type: QuestionType.FILL_BLANK, prompt: '___', payload: { acceptedAnswers: ['a'] }, points: 1 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update question validates the merged payload', async () => {
    const state = {
      assessment: { id: 'asm-1', isLocked: false },
      question: { id: 'q-1', assessmentId: 'asm-1', type: QuestionType.SINGLE_CHOICE, payload: validChoice },
    };
    const prisma = makePrisma(state);
    const service = new QuestionCrudService(prisma as never, schemaPolicy);
    await expect(
      service.update('asm-1', 'q-1', { payload: { options: [], correctOptionIds: [] } }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.question.update).not.toHaveBeenCalled();
  });
});
