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
    [QuestionType.FILL_BLANK, { acceptedAnswers: ['你好'], caseSensitive: false, pinyinSensitive: true }],
    [QuestionType.ORDERING, { tokens: ['我', '是', '学生'], correctSentence: '我是学生' }],
    [QuestionType.ESSAY, { sampleAnswer: '我是学生', rubric: 'Đúng ngữ pháp', maxLength: 500 }],
    [QuestionType.LISTENING, { mediaId: 'media-1', maxListens: 3 }],
    [QuestionType.IMAGE_BASED, { mediaId: 'media-1' }],
    [QuestionType.IMAGE_BASED, { mediaId: 'media-1', caption: 'Nhìn tranh chọn đáp án' }],
    [
      QuestionType.IMAGE_BASED,
      {
        mediaId: 'media-1',
        multiple: true,
        options: [
          { id: 'a', text: '猫' },
          { id: 'b', text: '狗' },
          { id: 'c', text: '鸟' },
        ],
        correctOptionIds: ['a', 'b'],
      },
    ],
    [
      QuestionType.IMAGE_BASED,
      {
        mediaId: 'media-1',
        options: [
          { id: 'a', text: '' },
          { id: 'b', text: '' },
        ],
        correctOptionIds: [],
      },
    ],
    [
      QuestionType.IMAGE_BASED,
      {
        options: [
          { id: 'a', text: '', imageMediaId: 'img-a' },
          { id: 'b', text: '', imageMediaId: 'img-b' },
        ],
        correctOptionIds: ['a'],
      },
    ],
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
    [QuestionType.FILL_BLANK, { acceptedAnswers: ['你好'], caseSensitive: 'true' }],
    [QuestionType.FILL_BLANK, { acceptedAnswers: ['你好'], pinyinSensitive: 'yes' }],
    [QuestionType.ORDERING, { tokens: ['我'] }],
    [QuestionType.ORDERING, { tokens: ['我', '好'] }],
    [QuestionType.ESSAY, { maxLength: -5 }],
    [QuestionType.LISTENING, { mediaId: 'media-1', maxListens: 'abc' }],
    [QuestionType.LISTENING, {}],
    [QuestionType.IMAGE_BASED, { mediaId: '' }],
    [QuestionType.IMAGE_BASED, { mediaId: 'media-1', caption: 123 }],
    [QuestionType.IMAGE_BASED, { mediaId: 'media-1', multiple: 'yes' }],
    [
      QuestionType.IMAGE_BASED,
      {
        mediaId: 'media-1',
        multiple: false,
        options: [
          { id: 'a', text: '猫' },
          { id: 'b', text: '狗' },
        ],
        correctOptionIds: ['a', 'b'],
      },
    ],
    [
      QuestionType.IMAGE_BASED,
      {
        mediaId: 'media-1',
        multiple: true,
        options: [
          { id: 'a', text: '猫' },
          { id: 'b', text: '狗' },
        ],
        correctOptionIds: ['a'],
      },
    ],
    [
      QuestionType.IMAGE_BASED,
      {
        options: [
          { id: 'a', text: '猫' },
          { id: 'b', text: '狗' },
        ],
        correctOptionIds: ['a'],
      },
    ],
    [
      QuestionType.IMAGE_BASED,
      {
        mediaId: 'media-1',
        options: [
          { id: 'a', text: '猫' },
          { id: 'b', text: '' },
        ],
        correctOptionIds: ['a'],
      },
    ],
    [
      QuestionType.SINGLE_CHOICE,
      {
        options: [
          { id: 'a', text: '你' },
          { id: 'a', text: '我' },
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
        correctOptionIds: ['a', 'a'],
      },
    ],
  ])('rejects invalid %s payload', (type, payload) => {
    expect(() => policy.validatePayload(type, payload)).toThrow(BadRequestException);
  });
});
