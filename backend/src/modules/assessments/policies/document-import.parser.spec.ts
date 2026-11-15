import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('accepts 1. numbering, inline A/B/C, skips headers, and maps answer text', () => {
    const parsed = parseImportedQuestions(`
CHÚC CÁC BẠN LÀM BÀI TỐT!
I. Nghe và chọn đáp án
1. A. 美国人 B. 法国人 C. 中国人
Đáp án: C

II. Đọc
2. Phiên âm của: “晚上”
A. guǎnshang
B. wǎnshang
C. wǎnshàng
Đáp án: wǎnshàng
Điểm: 3
`);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      type: QuestionType.LISTENING,
      needsReview: true,
      payload: { correctOptionIds: ['c'] },
    });
    expect(((parsed[0]?.payload.options ?? []) as Array<{ id: string }>).map((o) => o.id)).toEqual(['a', 'b', 'c']);
    expect(parsed[1]).toMatchObject({
      type: QuestionType.SINGLE_CHOICE,
      prompt: 'Phiên âm của: “晚上”',
      points: 3,
      needsReview: false,
      payload: { correctOptionIds: ['c'] },
    });
  });

  it('parses fill-blank, ordering, essay and multiple-choice from Loại markers', () => {
    const parsed = parseImportedQuestions(`
Câu 1. 老师，____！
Loại: Điền từ
Đáp án: 您好 | 你好
Pinyin sensitive: có

Câu 2. Sắp xếp thành câu.
Loại: Sắp xếp
Tokens: 我 / 姓 / 王 / 。
Đáp án: 我姓王。

Câu 3. Dịch: Tôi rất thích quyển sách này.
Loại: Tự luận
Đáp án mẫu: 我很喜欢这本书。

Câu 4. Chọn tất cả đáp án đúng
Loại: Nhiều đáp án
A. 北京
B. 美国
C. 越南
Đáp án: A, C
`);
    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toMatchObject({
      type: QuestionType.FILL_BLANK,
      needsReview: false,
      payload: { acceptedAnswers: ['您好', '你好'], pinyinSensitive: true },
    });
    expect(parsed[1]).toMatchObject({
      type: QuestionType.ORDERING,
      needsReview: false,
      payload: { tokens: ['我', '姓', '王', '。'], correctSentence: '我姓王。' },
    });
    expect(parsed[2]).toMatchObject({
      type: QuestionType.ESSAY,
      needsReview: false,
      payload: { sampleAnswer: '我很喜欢这本书。' },
    });
    expect(parsed[3]).toMatchObject({
      type: QuestionType.MULTIPLE_CHOICE,
      needsReview: false,
      payload: { correctOptionIds: ['a', 'c'] },
    });
  });

  it('flags listening/image types for review because media is attached later', () => {
    const parsed = parseImportedQuestions(`
Câu 1. Nghe và chọn
Loại: Nghe
Audio: nghe1.mp3
A. 李月
B. 刘月
C. 王月
Đáp án: A

Câu 2. Chọn tranh
Loại: Hình
Ảnh: hinh1.png
A. A
B. B
C. C
Đáp án: B
`);
    expect(parsed[0]?.type).toBe(QuestionType.LISTENING);
    expect(parsed[0]?.needsReview).toBe(true);
    expect(parsed[0]?.payload).not.toHaveProperty('audioFileName');
    expect(parsed[1]?.type).toBe(QuestionType.IMAGE_BASED);
    expect(parsed[1]?.needsReview).toBe(true);
    expect(parsed[1]?.payload).not.toHaveProperty('imageFileName');
  });

  it('parses the official import template into 5 non-media question types', () => {
    const text = readFileSync(resolve(process.cwd(), '../docs/templates/mau-de-import.txt'), 'utf8');
    const parsed = parseImportedQuestions(text);
    expect(parsed.map((q) => q.type)).toEqual([
      QuestionType.SINGLE_CHOICE,
      QuestionType.MULTIPLE_CHOICE,
      QuestionType.FILL_BLANK,
      QuestionType.ORDERING,
      QuestionType.ESSAY,
    ]);
    expect(parsed.every((q) => q.needsReview === false)).toBe(true);
    expect(parsed[1]?.payload).toMatchObject({ correctOptionIds: ['a', 'b'] });
    expect(parsed[2]?.payload).toMatchObject({ acceptedAnswers: ['您好', '你好'], pinyinSensitive: false });
    expect(parsed[3]?.payload).toMatchObject({
      tokens: ['我', '姓', '王', '，', '叫', '李天', '。'],
      correctSentence: '我姓王，叫李天。',
    });
    expect(parsed[4]?.payload).toMatchObject({ rubric: 'Đúng ngữ pháp 比, đủ ý tuổi tác.' });
  });

  it('parses a natural paper: (A) options, slash ordering, and a trailing answer key', () => {
    const parsed = parseImportedQuestions(`
I. Nghe
1. (A) 美国人 (B) 法国人 (C) 中国人

II. Đọc
2. 你好吗？
A. 我很好
B. 谢谢

Câu 3. Sắp xếp thành câu: 我 / 是 / 学生
Đáp án: 我是学生。

ĐÁP ÁN
1. C
2. A
`);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({
      type: QuestionType.LISTENING,
      needsReview: true,
      payload: { correctOptionIds: ['c'] },
    });
    expect(parsed[1]).toMatchObject({
      type: QuestionType.SINGLE_CHOICE,
      prompt: '你好吗？',
      needsReview: false,
      payload: { correctOptionIds: ['a'] },
    });
    expect(parsed[2]).toMatchObject({
      type: QuestionType.ORDERING,
      needsReview: false,
      payload: { tokens: ['我', '是', '学生'], correctSentence: '我是学生。' },
    });
  });

  it('drops a speaking block marked Loại: Nói', () => {
    const parsed = parseImportedQuestions(`
Câu 1. 你好吗？
A. 我很好
B. 谢谢
Đáp án: A

Câu 2.
Loại: Nói
Giới thiệu một người bạn.
`);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe(QuestionType.SINGLE_CHOICE);
  });
});
