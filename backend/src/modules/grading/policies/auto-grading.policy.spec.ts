import { QuestionType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  clampScoreToQuarter,
  matchesNormalizedBlank,
  matchesNormalizedOrdering,
  normalizeAnswerText,
  roundToQuarter,
  sumQuestionMaxScore,
} from './answer-normalizer.policy.js';
import {
  evaluateQuestionAnswer,
  summarizeSubmissionAutoGrade,
} from './auto-grading.policy.js';

describe('answer-normalizer.policy & auto-grading.policy (Slice 7.1 — DEC-037)', () => {
  describe('roundToQuarter & clampScoreToQuarter', () => {
    it('rounds numbers to 0.25 steps without negative zero', () => {
      expect(roundToQuarter(0)).toBe(0);
      expect(roundToQuarter(-0)).toBe(0);
      expect(roundToQuarter(Number.NaN)).toBe(0);
      expect(roundToQuarter(0.12)).toBe(0);
      expect(roundToQuarter(0.125)).toBe(0.25);
      expect(roundToQuarter(1 / 3)).toBe(0.25);
      expect(roundToQuarter(2 / 3)).toBe(0.75);
      expect(roundToQuarter(1.37)).toBe(1.25);
      expect(roundToQuarter(1.38)).toBe(1.5);
    });

    it('rounds scores to 0.25 without exceeding the question maximum', () => {
      expect(clampScoreToQuarter(-3, 5)).toBe(0);
      expect(clampScoreToQuarter(12, 5)).toBe(5);
      expect(clampScoreToQuarter(2.38, 5)).toBe(2.5);
      expect(clampScoreToQuarter(2, 0)).toBe(0);
      expect(clampScoreToQuarter(0.9, 0.9)).toBe(0.75);
      expect(clampScoreToQuarter(1.4, 1.4)).toBe(1.25);
    });
  });

  it('keeps historical question maxima and full credit after the assessment scale was frozen', () => {
    const questions = [
      { id: 'q-1', type: QuestionType.SINGLE_CHOICE, points: 0.33, payload: { correctOptionIds: ['a'] } },
      { id: 'q-2', type: QuestionType.SINGLE_CHOICE, points: 0.4, payload: { correctOptionIds: ['a'] } },
    ];
    const answers = new Map(questions.map(({ id }) => [id, { selectedOptionIds: ['a'] }]));
    const result = summarizeSubmissionAutoGrade(questions, answers);
    expect(result.questionResults.map(({ earnedPoints }) => earnedPoints)).toEqual([0.33, 0.4]);
    expect(result.autoScore).toBe(0.73);
    expect(sumQuestionMaxScore(questions)).toBe(0.73);
  });

  describe('normalizeAnswerText', () => {
    it('normalizes Unicode NFKC, trims edges, collapses whitespace, and strips trailing punctuation', () => {
      expect(normalizeAnswerText('  Ｎǐ　　ｈǎｏ 。  ')).toBe('nǐ hǎo');
      expect(normalizeAnswerText('  你好！  ')).toBe('你好');
      expect(normalizeAnswerText('Wǒ   xìng\n\tWáng?!.')).toBe('wǒ xìng wáng');
    });

    it('preserves case only when preserveCase is enabled', () => {
      expect(normalizeAnswerText('  Běijīng. ', { preserveCase: false })).toBe('běijīng');
      expect(normalizeAnswerText('  Běijīng. ', { preserveCase: true })).toBe('Běijīng');
    });
  });

  describe('evaluateQuestionAnswer across all QuestionTypes', () => {
    it('grades SINGLE_CHOICE accurately', () => {
      const q = {
        id: 'q-sc',
        type: QuestionType.SINGLE_CHOICE,
        points: 2,
        payload: {
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
          ],
          correctOptionIds: ['a'],
        },
      };
      expect(evaluateQuestionAnswer(q, { selectedOptionIds: ['a'] })).toEqual({
        questionId: 'q-sc',
        isObjective: true,
        isCorrect: true,
        earnedPoints: 2,
      });
      expect(evaluateQuestionAnswer(q, { selectedOptionIds: ['b'] })).toEqual({
        questionId: 'q-sc',
        isObjective: true,
        isCorrect: false,
        earnedPoints: 0,
      });
      expect(evaluateQuestionAnswer(q, {})).toEqual({
        questionId: 'q-sc',
        isObjective: true,
        isCorrect: false,
        earnedPoints: 0,
      });
    });

    it('applies partial credit with wrong-selection penalty (+P/K, -P/K, floor 0, step 0.25) for MULTIPLE_CHOICE', () => {
      const q2 = {
        id: 'q-mc-2',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 2,
        payload: {
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
            { id: 'd', text: 'D' },
          ],
          correctOptionIds: ['a', 'c'],
        },
      };
      // 2 right, 0 wrong -> full 2.0
      expect(evaluateQuestionAnswer(q2, { selectedOptionIds: ['a', 'c'] })).toEqual({
        questionId: 'q-mc-2',
        isObjective: true,
        isCorrect: true,
        earnedPoints: 2,
      });
      // 1 right, 0 wrong -> +1.0 (partial credit)
      expect(evaluateQuestionAnswer(q2, { selectedOptionIds: ['a'] })).toEqual({
        questionId: 'q-mc-2',
        isObjective: true,
        isCorrect: false,
        earnedPoints: 1,
      });
      // 1 right, 1 wrong -> (+1 - 1) = 0
      expect(evaluateQuestionAnswer(q2, { selectedOptionIds: ['a', 'b'] })).toEqual({
        questionId: 'q-mc-2',
        isObjective: true,
        isCorrect: false,
        earnedPoints: 0,
      });
      // 2 right, 1 wrong -> (+2 - 1) = 1
      expect(evaluateQuestionAnswer(q2, { selectedOptionIds: ['a', 'c', 'd'] })).toEqual({
        questionId: 'q-mc-2',
        isObjective: true,
        isCorrect: false,
        earnedPoints: 1,
      });
      // 0 right, 2 wrong -> floored at 0 (no negative score)
      expect(evaluateQuestionAnswer(q2, { selectedOptionIds: ['b', 'd'] })).toEqual({
        questionId: 'q-mc-2',
        isObjective: true,
        isCorrect: false,
        earnedPoints: 0,
      });

      // P=1, K=3 -> step rounding to 0.25
      const q3 = {
        id: 'q-mc-3',
        type: QuestionType.MULTIPLE_CHOICE,
        points: 1,
        payload: {
          options: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B' },
            { id: 'c', text: 'C' },
            { id: 'd', text: 'D' },
          ],
          correctOptionIds: ['a', 'b', 'c'],
        },
      };
      expect(evaluateQuestionAnswer(q3, { selectedOptionIds: ['a'] }).earnedPoints).toBe(0.25);
      expect(evaluateQuestionAnswer(q3, { selectedOptionIds: ['a', 'b'] }).earnedPoints).toBe(0.75);
      expect(evaluateQuestionAnswer(q3, { selectedOptionIds: ['a', 'b', 'c'] }).earnedPoints).toBe(1);
    });

    it('grades FILL_BLANK with Unicode NFKC, space/punctuation normalization & pinyinSensitive toggle', () => {
      const caseInsensitiveQ = {
        id: 'q-fb-1',
        type: QuestionType.FILL_BLANK,
        points: 1.5,
        payload: {
          acceptedAnswers: ['Nǐ hǎo', '你好'],
          pinyinSensitive: false,
        },
      };
      expect(evaluateQuestionAnswer(caseInsensitiveQ, { text: '  nǐ   ｈǎｏ！ ' })).toEqual({
        questionId: 'q-fb-1',
        isObjective: true,
        isCorrect: true,
        earnedPoints: 1.5,
      });
      expect(evaluateQuestionAnswer(caseInsensitiveQ, { text: '  你好。' }).isCorrect).toBe(true);
      expect(evaluateQuestionAnswer(caseInsensitiveQ, { text: '   ' }).isCorrect).toBe(false);

      const pinyinSensitiveQ = {
        id: 'q-fb-2',
        type: QuestionType.FILL_BLANK,
        points: 1.5,
        payload: {
          acceptedAnswers: ['Nǐ hǎo'],
          pinyinSensitive: true,
        },
      };
      expect(evaluateQuestionAnswer(pinyinSensitiveQ, { text: 'nǐ hǎo' }).isCorrect).toBe(false);
      expect(evaluateQuestionAnswer(pinyinSensitiveQ, { text: ' Nǐ  hǎo . ' }).isCorrect).toBe(true);
      expect(matchesNormalizedBlank('ni hao', ['nǐ hǎo'])).toBe(false);
    });

    it('grades ORDERING for both spaced Pinyin and compact CJK sentences', () => {
      const cjkOrder = {
        id: 'q-ord-1',
        type: QuestionType.ORDERING,
        points: 2,
        payload: {
          tokens: ['我', '姓', '王'],
          correctSentence: '我姓王。',
        },
      };
      expect(evaluateQuestionAnswer(cjkOrder, { orderedTokens: ['我', '姓', '王'] })).toEqual({
        questionId: 'q-ord-1',
        isObjective: true,
        isCorrect: true,
        earnedPoints: 2,
      });
      expect(evaluateQuestionAnswer(cjkOrder, { orderedTokens: ['王', '姓', '我'] }).isCorrect).toBe(
        false,
      );

      const pinyinOrder = {
        id: 'q-ord-2',
        type: QuestionType.ORDERING,
        points: 1,
        payload: {
          tokens: ['Wǒ', 'xìng', 'Wáng'],
          correctSentence: 'wǒ xìng wáng.',
          pinyinSensitive: false,
        },
      };
      expect(evaluateQuestionAnswer(pinyinOrder, { orderedTokens: ['Wǒ', 'xìng', 'Wáng'] }).isCorrect).toBe(
        true,
      );
      expect(matchesNormalizedOrdering([], '我姓王')).toBe(false);
    });

    it('grades LISTENING & IMAGE_BASED objectively when options or acceptedAnswers exist, and treats ESSAY as subjective', () => {
      const imageMulti = {
        id: 'q-img-multi',
        type: QuestionType.IMAGE_BASED,
        points: 2,
        payload: {
          mediaId: 'img-1',
          multiple: true,
          options: [
            { id: 'a', text: 'Táo' },
            { id: 'b', text: 'Māo' },
            { id: 'c', text: 'Gǒu' },
          ],
          correctOptionIds: ['a', 'c'],
        },
      };
      expect(evaluateQuestionAnswer(imageMulti, { selectedOptionIds: ['a'] })).toEqual({
        questionId: 'q-img-multi',
        isObjective: true,
        isCorrect: false,
        earnedPoints: 1,
      });

      const listeningBlank = {
        id: 'q-list-blank',
        type: QuestionType.LISTENING,
        points: 1,
        payload: {
          mediaId: 'aud-1',
          acceptedAnswers: ['谢谢'],
        },
      };
      expect(evaluateQuestionAnswer(listeningBlank, { text: ' 谢谢！ ' })).toEqual({
        questionId: 'q-list-blank',
        isObjective: true,
        isCorrect: true,
        earnedPoints: 1,
      });

      const listeningOpen = {
        id: 'q-list-open',
        type: QuestionType.LISTENING,
        points: 3,
        payload: { mediaId: 'aud-2' },
      };
      expect(evaluateQuestionAnswer(listeningOpen, { text: 'Nghe được nội dung' })).toEqual({
        questionId: 'q-list-open',
        isObjective: false,
        isCorrect: null,
        earnedPoints: null,
      });

      const essay = {
        id: 'q-essay',
        type: QuestionType.ESSAY,
        points: 5,
        payload: { sampleAnswer: 'Mẫu' },
      };
      expect(evaluateQuestionAnswer(essay, { text: 'Bài tự luận' })).toEqual({
        questionId: 'q-essay',
        isObjective: false,
        isCorrect: null,
        earnedPoints: null,
      });

      const summary = summarizeSubmissionAutoGrade(
        [imageMulti, listeningBlank, essay],
        new Map<string, unknown>([
          ['q-img-multi', { selectedOptionIds: ['a'] }],
          ['q-list-blank', { text: '谢谢' }],
          ['q-essay', { text: 'Bài làm' }],
        ]),
      );
      expect(summary.autoScore).toBe(2);
      expect(summary.hasSubjectiveQuestions).toBe(true);
      expect(summary.questionResults).toHaveLength(3);
    });

    it('Issue #6a: preserves word boundaries for spaced ordering answers (xī xīxī vs xīxī xī)', () => {
      expect(matchesNormalizedOrdering(['xī', 'xīxī'], 'xī xīxī')).toBe(true);
      expect(matchesNormalizedOrdering(['xīxī', 'xī'], 'xī xīxī')).toBe(false);
    });
  });
});
