import { BadRequestException } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { isAnswerNonEmpty, SubmissionAnswerPolicy } from './submission-answer.policy.js';

const FORBIDDEN_SECRET_KEYS = [
  'correctOptionIds',
  'acceptedAnswers',
  'correctSentence',
  'sampleAnswer',
  'rubric',
  'explanation',
  'caseSensitive',
  'pinyinSensitive',
] as const;

function collectAllObjectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAllObjectKeys(item, keys);
    }
    return keys;
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.push(k);
      collectAllObjectKeys(v, keys);
    }
  }
  return keys;
}

describe('SubmissionAnswerPolicy', () => {
  const policy = new SubmissionAnswerPolicy();

  describe('sanitizeQuestionForStudent — Zero-Leak guarantee across all 7 QuestionTypes', () => {
    it.each([
      {
        label: 'SINGLE_CHOICE',
        question: {
          id: 'q-1',
          position: 1,
          type: QuestionType.SINGLE_CHOICE,
          prompt: 'Chọn nghĩa của 你好',
          points: 1,
          payload: {
            options: [
              { id: 'a', text: 'Xin chào' },
              { id: 'b', text: 'Tạm biệt', imageMediaId: 'img-b' },
            ],
            correctOptionIds: ['a'],
            explanation: 'Secret explanation',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.options).toEqual([
            { id: 'a', text: 'Xin chào' },
            { id: 'b', text: 'Tạm biệt', imageMediaId: 'img-b' },
          ]);
        },
      },
      {
        label: 'MULTIPLE_CHOICE',
        question: {
          id: 'q-2',
          position: 2,
          type: QuestionType.MULTIPLE_CHOICE,
          prompt: 'Chọn tất cả danh từ',
          points: 2,
          payload: {
            options: [
              { id: 'a', text: '书' },
              { id: 'b', text: '人' },
              { id: 'c', text: '跑' },
            ],
            correctOptionIds: ['a', 'b'],
            explanation: 'Secret multiple explanation',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.options).toHaveLength(3);
        },
      },
      {
        label: 'FILL_BLANK',
        question: {
          id: 'q-3',
          position: 3,
          type: QuestionType.FILL_BLANK,
          prompt: 'Điền từ: 我___学生',
          points: 1,
          payload: {
            acceptedAnswers: ['是'],
            caseSensitive: false,
            pinyinSensitive: true,
            explanation: 'Secret fill blank',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.options).toBeUndefined();
          expect(dto.tokens).toBeUndefined();
        },
      },
      {
        label: 'ORDERING',
        question: {
          id: 'q-4',
          position: 4,
          type: QuestionType.ORDERING,
          prompt: 'Sắp xếp thành câu hoàn chỉnh',
          points: 2,
          payload: {
            tokens: ['我', '是', '学生'],
            correctSentence: '我是学生',
            explanation: 'Secret ordering explanation',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.tokens).toHaveLength(3);
          expect([...(dto.tokens ?? [])].sort()).toEqual(['我', '是', '学生'].sort());
        },
      },
      {
        label: 'ESSAY',
        question: {
          id: 'q-5',
          position: 5,
          type: QuestionType.ESSAY,
          prompt: 'Viết đoạn văn giới thiệu bản thân',
          points: 5,
          payload: {
            sampleAnswer: '我叫小明...',
            rubric: 'Đủ 3 ý',
            maxLength: 500,
            explanation: 'Secret essay notes',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.maxLength).toBe(500);
        },
      },
      {
        label: 'LISTENING with options',
        question: {
          id: 'q-6',
          position: 6,
          type: QuestionType.LISTENING,
          prompt: 'Nghe và chọn đáp án',
          points: 2,
          payload: {
            mediaId: 'audio-1',
            maxListens: 3,
            options: [
              { id: 'a', text: 'A' },
              { id: 'b', text: 'B' },
            ],
            correctOptionIds: ['a'],
            sampleAnswer: 'Transcript leak',
            explanation: 'Listening explanation',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.mediaId).toBe('audio-1');
          expect(dto.maxListens).toBe(3);
          expect(dto.options).toEqual([
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ]);
        },
      },
      {
        label: 'LISTENING dictation without options',
        question: {
          id: 'q-6b',
          position: 7,
          type: QuestionType.LISTENING,
          prompt: 'Nghe và viết lại',
          points: 2,
          payload: {
            mediaId: 'audio-2',
            acceptedAnswers: ['你好'],
            explanation: 'Secret transcript',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.mediaId).toBe('audio-2');
          expect(dto.options).toBeUndefined();
        },
      },
      {
        label: 'IMAGE_BASED with options',
        question: {
          id: 'q-7',
          position: 8,
          type: QuestionType.IMAGE_BASED,
          prompt: 'Nhìn ảnh chọn đáp án đúng',
          points: 2,
          payload: {
            mediaId: 'img-stem',
            caption: 'Gia đình',
            multiple: true,
            options: [
              { id: 'a', text: '爸爸', imageMediaId: 'img-a' },
              { id: 'b', text: '妈妈', imageMediaId: 'img-b' },
            ],
            correctOptionIds: ['a', 'b'],
            explanation: 'Secret image explanation',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.mediaId).toBe('img-stem');
          expect(dto.caption).toBe('Gia đình');
          expect(dto.multiple).toBe(true);
          expect(dto.options).toEqual([
            { id: 'a', text: '爸爸', imageMediaId: 'img-a' },
            { id: 'b', text: '妈妈', imageMediaId: 'img-b' },
          ]);
        },
      },
      {
        label: 'IMAGE_BASED with blank placeholder options omits options',
        question: {
          id: 'q-7b',
          position: 9,
          type: QuestionType.IMAGE_BASED,
          prompt: 'Mô tả bức tranh',
          points: 3,
          payload: {
            mediaId: 'img-stem-2',
            options: [
              { id: 'a', text: '' },
              { id: 'b', text: '' },
            ],
            correctOptionIds: [],
            sampleAnswer: 'Sample',
            rubric: 'Rubric',
          },
        },
        assertShape: (dto: ReturnType<SubmissionAnswerPolicy['sanitizeQuestionForStudent']>) => {
          expect(dto.mediaId).toBe('img-stem-2');
          expect(dto.options).toBeUndefined();
        },
      },
    ])('emits zero forbidden secret keys for $label', ({ question, assertShape }) => {
      const sanitized = policy.sanitizeQuestionForStudent(question, 'sub-seed-1');
      const serialized = JSON.stringify(sanitized);
      const allKeys = collectAllObjectKeys(JSON.parse(serialized));

      for (const secret of FORBIDDEN_SECRET_KEYS) {
        expect(allKeys).not.toContain(secret);
        expect(serialized).not.toContain(`"${secret}"`);
      }
      expect(sanitized.id).toBe(question.id);
      expect(sanitized.position).toBe(question.position);
      expect(sanitized.type).toBe(question.type);
      expect(sanitized.prompt).toBe(question.prompt);
      expect(sanitized.points).toBe(question.points);
      assertShape(sanitized);
    });
  });

  describe('ORDERING deterministic shuffle', () => {
    it('produces the exact same token sequence for the same (seedKey, questionId)', () => {
      const q = {
        id: 'q-ord-1',
        position: 1,
        type: QuestionType.ORDERING,
        prompt: 'Sắp xếp',
        points: 1,
        payload: {
          tokens: ['今天', '天气', '真', '好'],
          correctSentence: '今天天气真好',
        },
      };

      const first = policy.sanitizeQuestionForStudent(q, 'sub-123').tokens;
      const second = policy.sanitizeQuestionForStudent(q, 'sub-123').tokens;
      expect(first).toEqual(second);
    });

    it('never emits the original token order or correctSentence when >= 2 distinct tokens exist', () => {
      const twoTokenQ = {
        id: 'q-ord-2',
        position: 1,
        type: QuestionType.ORDERING,
        prompt: 'Sắp xếp',
        points: 1,
        payload: {
          tokens: ['你', '好'],
          correctSentence: '你好',
        },
      };
      for (let i = 0; i < 40; i += 1) {
        const res = policy.sanitizeQuestionForStudent(twoTokenQ, `seed-${i}`);
        expect(res.tokens).toEqual(['好', '你']);
      }

      const threeTokenQ = {
        id: 'q-ord-3',
        position: 2,
        type: QuestionType.ORDERING,
        prompt: 'Sắp xếp',
        points: 1,
        payload: {
          tokens: ['学生', '是', '我'],
          correctSentence: '我是学生',
        },
      };
      for (let i = 0; i < 40; i += 1) {
        const res = policy.sanitizeQuestionForStudent(threeTokenQ, `seed-${i}`);
        expect(res.tokens).not.toEqual(['学生', '是', '我']);
        expect(res.tokens?.join('')).not.toBe('我是学生');
        expect([...(res.tokens ?? [])].sort()).toEqual(['学生', '是', '我'].sort());
      }
    });

    it('handles ordering questions with identical tokens without hanging', () => {
      const q = {
        id: 'q-ord-same',
        position: 1,
        type: QuestionType.ORDERING,
        prompt: 'Sắp xếp',
        points: 1,
        payload: { tokens: ['A', 'A'], correctSentence: 'AA' },
      };

      expect(policy.sanitizeQuestionForStudent(q, 'seed-1').tokens).toEqual(['A', 'A']);
    });
  });

  describe('validateStudentAnswer', () => {
    it('validates SINGLE_CHOICE: allows 0 or 1 valid option, rejects >1, duplicates, or unknown option IDs', () => {
      const q = {
        id: 'q-sc',
        type: QuestionType.SINGLE_CHOICE,
        payload: {
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
          correctOptionIds: ['a'],
        },
      };

      expect(
        policy.validateStudentAnswer(q, { selectedOptionIds: ['b'], extraTamper: true }, 0),
      ).toEqual({
        normalizedPayload: { selectedOptionIds: ['b'] },
        nextAudioPlayCount: 0,
      });

      expect(policy.validateStudentAnswer(q, { selectedOptionIds: [] }, 0)).toEqual({
        normalizedPayload: { selectedOptionIds: [] },
        nextAudioPlayCount: 0,
      });

      expect(() =>
        policy.validateStudentAnswer(q, { selectedOptionIds: ['a', 'b'] }, 0),
      ).toThrow(BadRequestException);
      expect(() =>
        policy.validateStudentAnswer(q, { selectedOptionIds: ['invalid'] }, 0),
      ).toThrow(BadRequestException);
      expect(() => policy.validateStudentAnswer(q, {}, 0)).toThrow(BadRequestException);
    });

    it('validates MULTIPLE_CHOICE: allows unique valid options, rejects duplicates or unknown option IDs', () => {
      const q = {
        id: 'q-mc',
        type: QuestionType.MULTIPLE_CHOICE,
        payload: {
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
          ],
          correctOptionIds: ['a', 'b'],
        },
      };

      expect(
        policy.validateStudentAnswer(q, { selectedOptionIds: ['a', 'c'] }, 0),
      ).toEqual({
        normalizedPayload: { selectedOptionIds: ['a', 'c'] },
        nextAudioPlayCount: 0,
      });

      expect(() =>
        policy.validateStudentAnswer(q, { selectedOptionIds: ['a', 'a'] }, 0),
      ).toThrow(BadRequestException);
      expect(() =>
        policy.validateStudentAnswer(q, { selectedOptionIds: ['a', 'nope'] }, 0),
      ).toThrow(BadRequestException);
    });

    it('validates FILL_BLANK and ESSAY: enforces string type and maxLength', () => {
      const fillQ = {
        id: 'q-fb',
        type: QuestionType.FILL_BLANK,
        payload: { acceptedAnswers: ['你好'] },
      };
      expect(policy.validateStudentAnswer(fillQ, { text: '你好', extra: 1 }, 0)).toEqual({
        normalizedPayload: { text: '你好' },
        nextAudioPlayCount: 0,
      });
      expect(() => policy.validateStudentAnswer(fillQ, { text: 123 }, 0)).toThrow(
        BadRequestException,
      );
      expect(() =>
        policy.validateStudentAnswer(fillQ, { text: 'a'.repeat(10_001) }, 0),
      ).toThrow(BadRequestException);

      const essayQ = {
        id: 'q-es',
        type: QuestionType.ESSAY,
        payload: { maxLength: 5 },
      };
      expect(policy.validateStudentAnswer(essayQ, { text: '12345' }, 0)).toEqual({
        normalizedPayload: { text: '12345' },
        nextAudioPlayCount: 0,
      });
      expect(() => policy.validateStudentAnswer(essayQ, { text: '123456' }, 0)).toThrow(
        BadRequestException,
      );
    });

    it('validates ORDERING: allows cleared [] or exact token multiset, rejects tampered multisets', () => {
      const q = {
        id: 'q-ord',
        type: QuestionType.ORDERING,
        payload: {
          tokens: ['A', 'A', 'B'],
          correctSentence: 'AAB',
        },
      };

      expect(policy.validateStudentAnswer(q, { orderedTokens: ['B', 'A', 'A'] }, 0)).toEqual({
        normalizedPayload: { orderedTokens: ['B', 'A', 'A'] },
        nextAudioPlayCount: 0,
      });
      expect(policy.validateStudentAnswer(q, { orderedTokens: [] }, 0)).toEqual({
        normalizedPayload: { orderedTokens: [] },
        nextAudioPlayCount: 0,
      });

      expect(() => policy.validateStudentAnswer(q, { orderedTokens: ['A', 'B', 'B'] }, 0)).toThrow(
        BadRequestException,
      );
      expect(() => policy.validateStudentAnswer(q, { orderedTokens: ['A', 'B'] }, 0)).toThrow(
        BadRequestException,
      );
      expect(() => policy.validateStudentAnswer(q, { orderedTokens: ['X', 'Y', 'Z'] }, 0)).toThrow(
        BadRequestException,
      );
    });

    it('validates LISTENING and IMAGE_BASED for both choice-mode and text-mode, plus audioPlayCount', () => {
      const listeningChoice = {
        id: 'q-list-1',
        type: QuestionType.LISTENING,
        payload: {
          mediaId: 'audio-1',
          maxListens: 2,
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
          correctOptionIds: ['a'],
        },
      };

      expect(
        policy.validateStudentAnswer(listeningChoice, { selectedOptionIds: ['a'] }, 1, 2),
      ).toEqual({
        normalizedPayload: { selectedOptionIds: ['a'] },
        nextAudioPlayCount: 2,
      });

      // Saving answer without incrementing audioPlayCount at limit still succeeds
      expect(
        policy.validateStudentAnswer(listeningChoice, { selectedOptionIds: ['b'] }, 2),
      ).toEqual({
        normalizedPayload: { selectedOptionIds: ['b'] },
        nextAudioPlayCount: 2,
      });

      // Decrementing audioPlayCount rejected
      expect(() =>
        policy.validateStudentAnswer(listeningChoice, { selectedOptionIds: ['a'] }, 2, 1),
      ).toThrow(BadRequestException);

      // Exceeding maxListens rejected
      expect(() =>
        policy.validateStudentAnswer(listeningChoice, { selectedOptionIds: ['a'] }, 2, 3),
      ).toThrowError(new BadRequestException('Đã hết lượt nghe cho phép'));

      const listeningText = {
        id: 'q-list-2',
        type: QuestionType.LISTENING,
        payload: { mediaId: 'audio-2' },
      };
      expect(policy.validateStudentAnswer(listeningText, { text: '你好' }, 0, 5)).toEqual({
        normalizedPayload: { text: '你好' },
        nextAudioPlayCount: 5,
      });

      const imageMultiple = {
        id: 'q-img-1',
        type: QuestionType.IMAGE_BASED,
        payload: {
          mediaId: 'img-1',
          multiple: true,
          options: [
            { id: 'a', text: 'Cat' },
            { id: 'b', text: 'Dog' },
          ],
          correctOptionIds: ['a', 'b'],
        },
      };
      expect(
        policy.validateStudentAnswer(imageMultiple, { selectedOptionIds: ['a', 'b'] }, 0),
      ).toEqual({
        normalizedPayload: { selectedOptionIds: ['a', 'b'] },
        nextAudioPlayCount: 0,
      });

      const imageOpenEnded = {
        id: 'q-img-2',
        type: QuestionType.IMAGE_BASED,
        payload: {
          mediaId: 'img-2',
          options: [
            { id: 'a', text: '' },
            { id: 'b', text: '' },
          ],
          correctOptionIds: [],
        },
      };
      expect(policy.validateStudentAnswer(imageOpenEnded, { text: 'Con mèo' }, 0)).toEqual({
        normalizedPayload: { text: 'Con mèo' },
        nextAudioPlayCount: 0,
      });
    });
  });

  describe('isAnswerNonEmpty', () => {
    it('detects non-empty vs empty/whitespace answers across all payload types', () => {
      expect(isAnswerNonEmpty({ selectedOptionIds: ['a'] })).toBe(true);
      expect(isAnswerNonEmpty({ orderedTokens: ['我'] })).toBe(true);
      expect(isAnswerNonEmpty({ text: '你好' })).toBe(true);
      expect(policy.isAnswerNonEmpty({ text: ' a ' })).toBe(true);

      expect(isAnswerNonEmpty({})).toBe(false);
      expect(isAnswerNonEmpty(null)).toBe(false);
      expect(isAnswerNonEmpty({ selectedOptionIds: [] })).toBe(false);
      expect(isAnswerNonEmpty({ orderedTokens: [] })).toBe(false);
      expect(isAnswerNonEmpty({ text: '' })).toBe(false);
      expect(isAnswerNonEmpty({ text: '   \n\t ' })).toBe(false);
    });
  });
});
