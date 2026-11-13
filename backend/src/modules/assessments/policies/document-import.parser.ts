import { QuestionType } from '@prisma/client';

export type ParsedDraftQuestion = {
  type: QuestionType;
  prompt: string;
  payload: Record<string, unknown>;
  points: number;
  needsReview: boolean;
};

export type ExtractedImage = { mime: string; bytes: Buffer };

const QUESTION_RE = /^(?:câu\s+)?(\d+)\s*[.)、．:：]\s*(.*)$/i;
const OPTION_RE = /^([A-D])\s*[.)、．]\s*(.+)$/i;
const ANSWER_RE = /^(?:đáp\s*án(?:\s*đúng)?|answer|答案)\s*[:：]\s*([A-D])\s*$/i;

type Draft = {
  promptLines: string[];
  options: Array<{ id: string; text: string }>;
  answer: string | null;
};

export function htmlToPlainText(html: string): { text: string; images: ExtractedImage[] } {
  const images: ExtractedImage[] = [];
  const withoutImgs = html.replace(
    /<img\b[^>]*src="data:([^;]+);base64,([^"]+)"[^>]*>/gi,
    (_m, mime: string, b64: string) => {
      images.push({ mime, bytes: Buffer.from(b64, 'base64') });
      return '\n';
    },
  );
  const text = withoutImgs
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  return { text, images };
}

export function parseImportedQuestions(text: string): ParsedDraftQuestion[] {
  const out: ParsedDraftQuestion[] = [];
  let current: Draft | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const questionMatch = line.match(QUESTION_RE);
    const optionMatch = line.match(OPTION_RE);
    const answerMatch = line.match(ANSWER_RE);

    if (questionMatch && !optionMatch) {
      const flushed = flushDraft(current);
      if (flushed) out.push(flushed);
      current = {
        promptLines: questionMatch[2] ? [questionMatch[2]] : [],
        options: [],
        answer: null,
      };
      continue;
    }
    if (!current) continue;
    if (optionMatch) {
      current.options.push({ id: optionMatch[1]!.toLowerCase(), text: optionMatch[2]! });
      continue;
    }
    if (answerMatch) {
      current.answer = answerMatch[1]!.toLowerCase();
      continue;
    }
    current.promptLines.push(line);
  }
  const last = flushDraft(current);
  if (last) out.push(last);
  return out;
}

function flushDraft(draft: Draft | null): ParsedDraftQuestion | null {
  if (!draft) return null;
  const prompt = draft.promptLines.join('\n').trim();
  if (!prompt && draft.options.length === 0) return null;
  const optionCountOk = draft.options.length >= 2 && draft.options.length <= 4;
  const answerId = draft.answer;
  const hasAnswer = answerId !== null && draft.options.some((o) => o.id === answerId);
  return {
    type: QuestionType.SINGLE_CHOICE,
    prompt: prompt || '(chưa có nội dung)',
    payload: {
      options: draft.options,
      correctOptionIds: hasAnswer ? [answerId] : [],
    },
    points: 1,
    needsReview: !optionCountOk || !hasAnswer,
  };
}
