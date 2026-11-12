import { BadRequestException } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { QuestionSchemaPolicy } from './question-schema.policy.js';

describe('QuestionSchemaPolicy (Task 5.2 TDD)', () => {
  const policy = new QuestionSchemaPolicy();

  it.each([
    [
      QuestionType.SINGLE_CHOICE,
      {
        options: [
          { id: 'a', text: '你' },
          { id: 'b', text: '我' },
        ],
        correctOptionIds: ['a'],
      },
    ],
    [
      QuestionType.MULTIPLE_CHOICE,
      {
        options: [
          { id: 'a', text: '你' },
          { id: 'b', text: '我' },
          { id: 'c', text: '他' },
        ],
        correctOptionIds: ['a', 'b'],
      },
    ],
    [QuestionType.FILL_BLANK, { acceptedAnswers: ['你好', '您好'] }],
    [QuestionType.ORDERING, { tokens: ['我', '是', '学生'] }],
    [QuestionType.ESSAY, { sampleAnswer: '我是学生', rubric: 'Đúng ngữ pháp' }],
    [QuestionType.LISTENING, { mediaId: 'media-1' }],
    [QuestionType.IMAGE_BASED, { mediaId: 'media-1' }],
  ])('accepts valid %s payload', (type, payload) => {
    expect(() => policy.validatePayload(type, payload)).not.toThrow();
  });

  it.each([
    [QuestionType.SINGLE_CHOICE, { options: [{ id: 'a', text: '你' }], correctOptionIds: ['a'] }],
    [
      QuestionType.SINGLE_CHOICE,
      {
        options: [
          { id: 'a', text: '你' },
          { id: 'b', text: '我' },
        ],
        correctOptionIds: [],
      },
    ],
    [
      QuestionType.SINGLE_CHOICE,
      {
        options: [
          { id: 'a', text: '你' },
          { id: 'b', text: '我' },
        ],
        correctOptionIds: ['zzz'],
      },
    ],
    [
      QuestionType.MULTIPLE_CHOICE,
      {
        options: [
          { id: 'a', text: '你' },
          { id: 'b', text: '我' },
        ],
        correctOptionIds: ['a'],
      },
    ],
    [QuestionType.FILL_BLANK, { acceptedAnswers: [] }],
    [QuestionType.FILL_BLANK, { acceptedAnswers: ['  '] }],
    [QuestionType.ORDERING, { tokens: ['我'] }],
    [QuestionType.LISTENING, {}],
    [QuestionType.IMAGE_BASED, { mediaId: '' }],
  ])('rejects invalid %s payload', (type, payload) => {
    expect(() => policy.validatePayload(type, payload)).toThrow(BadRequestException);
  });
});
