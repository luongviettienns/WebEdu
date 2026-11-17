import { expect, test } from '@playwright/test';
import { deterministicShuffleTokens } from '../components/QuestionPreviewFields';
import { addBlankOption, removeOptionAt, splitTeacherLines } from './question-payload';

test('splitTeacherLines accepts Word-template delimiters and line breaks', () => {
  expect(splitTeacherLines('您好 | 你好', '|')).toEqual(['您好', '你好']);
  expect(splitTeacherLines('我 / 姓 / 王 / 。', '/')).toEqual(['我', '姓', '王', '。']);
  expect(splitTeacherLines(' 您好 \n 你好 ', '|')).toEqual(['您好', '你好']);
  expect(splitTeacherLines('một dòng', '|')).toEqual(['một dòng']);
});

test('addBlankOption keeps option IDs sorted alphabetically after removing first or middle option (BUG-M6-05)', () => {
  const start = {
    options: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
    ],
    correctOptionIds: ['a'],
  };
  const removedMiddle = removeOptionAt(start, 1);
  expect((addBlankOption(removedMiddle).options as Array<{ id: string }>).map((o) => o.id)).toEqual([
    'a',
    'b',
    'c',
  ]);
  const removedFirst = removeOptionAt(start, 0);
  expect((addBlankOption(removedFirst).options as Array<{ id: string }>).map((o) => o.id)).toEqual([
    'a',
    'b',
    'c',
  ]);
});

test('deterministicShuffleTokens never leaks identical answer order when >= 2 tokens (BUG-M6-02)', () => {
  const ordered = ['我', '喜欢', '汉语'];
  const shuffled = deterministicShuffleTokens(ordered, 'q-ordering-1');
  expect(shuffled.slice().sort()).toEqual(ordered.slice().sort());
  expect(shuffled).not.toEqual(ordered);
});
