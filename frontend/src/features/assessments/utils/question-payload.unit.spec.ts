import { expect, test } from '@playwright/test';
import { splitTeacherLines } from './question-payload';

test('splitTeacherLines accepts Word-template delimiters and line breaks', () => {
  expect(splitTeacherLines('您好 | 你好', '|')).toEqual(['您好', '你好']);
  expect(splitTeacherLines('我 / 姓 / 王 / 。', '/')).toEqual(['我', '姓', '王', '。']);
  expect(splitTeacherLines(' 您好 \n 你好 ', '|')).toEqual(['您好', '你好']);
  expect(splitTeacherLines('một dòng', '|')).toEqual(['một dòng']);
});
