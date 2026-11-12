import { QuestionType } from '@prisma/client';
import { htmlToPlainText, parseImportedQuestions } from './document-import.parser.js';

const FIXTURE = `Câu 1. 你好吗？
A. 我很好
B. 我是学生
C. 谢谢
D. 再见
Đáp án: A

Câu 2. nǐ hǎo, 你叫什么名字？
A. 我叫小明
B. 我很好
C. 对不起
Đáp án: A

Câu 3. 今天星期几？
A. 星期一
B. 现在
C. 明天
`;

describe('document-import.parser (Task 5.3 TDD)', () => {
  it('parses three single-choice questions and flags missing answers', () => {
    const parsed = parseImportedQuestions(FIXTURE);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      type: QuestionType.SINGLE_CHOICE,
      prompt: '你好吗？',
      points: 1,
      needsReview: false,
      payload: { correctOptionIds: ['a'] },
    });
    expect(parsed[1]?.prompt).toBe('nǐ hǎo, 你叫什么名字？');
    expect(parsed[1]?.needsReview).toBe(false);
    expect(parsed[2]?.needsReview).toBe(true);
    expect((parsed[2]?.payload.correctOptionIds as string[])).toEqual([]);
  });

  it('extracts embedded images from mammoth HTML without normalizing text', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    const { text, images } = htmlToPlainText(
      `<p>Câu 1. 看图 nǐ hǎo</p><img src="data:image/png;base64,${png}" /><p>A. 猫</p>`,
    );
    expect(text).toContain('看图 nǐ hǎo');
    expect(images).toHaveLength(1);
    expect(images[0]?.mime).toBe('image/png');
  });
});
