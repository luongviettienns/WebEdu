import { QuestionType } from '@prisma/client';
import { flushDraft, fold, splitTokens, type ImportDraft } from './document-import-flush.util.js';

export type ParsedDraftQuestion = {
  type: QuestionType;
  prompt: string;
  payload: Record<string, unknown>;
  points: number;
  needsReview: boolean;
};

export type ExtractedImage = { mime: string; bytes: Buffer };

const QUESTION_RE = /^(?:#\s*)?(?:câu\s+)?(\d+)\s*[.)、．:：]\s*(.*)$/i;
const OPTION_LINE_RE = /^(?:\(([A-D])\)|([A-D])\s*[.)、．:：])\s*(.+)$/i;
const INLINE_OPTION_RE = /(?:\(([A-D])\)|([A-D])\s*[.)、．:：])\s*/gi;
const ANSWER_RE = /^(?:đáp\s*án(?:\s*(?:đúng|mẫu))?|answer|答案)\s*[:：]\s*(.+)$/i;
const ANSWER_KEY_HEADER_RE = /^(?:đáp\s*án(?:\s*(?:đúng|mẫu))?|keys?|答案)\s*$/i;
const TYPE_RE = /^(?:loại|type|dạng)\s*[:：]\s*(.+)$/i;
const POINTS_RE = /^(?:điểm|points?)\s*[:：]\s*(.*)$/i;
const TOKENS_RE = /^(?:tokens?|mảnh(?:\s*từ)?)\s*[:：]\s*(.+)$/i;
const AUDIO_RE = /^(?:audio|file nghe)\s*[:：]\s*(.+)$/i;
const IMAGE_RE = /^(?:ảnh|hình(?:\s*ảnh)?|image|file ảnh)\s*[:：]\s*(.+)$/i;
const RUBRIC_RE = /^(?:tiêu chí|rubric)\s*[:：]\s*(.+)$/i;
const MAX_LISTENS_RE = /^(?:số\s*lần\s*nghe|max\s*listens?)\s*[:：]\s*(\d+)$/i;
const PINYIN_RE = /^(?:pinyin\s*sensitive|phân\s*biệt\s*(?:dấu\s*thanh|pinyin))\s*[:：]\s*(.+)$/i;
const SECTION_RE =
  /^(?:phần\s+(nghe|đọc|viết|nói)\b|(?:i{1,3}|iv|v|vi{0,3}|ix|x)\.\s*(nghe|đọc|viết|nói|listen(?:ing)?|reading|writing|speaking)\b)/i;
const SKIP_RE =
  /^(chúc các bạn\b|tiếng trung cho người|mini\s*test\b|mẫu đề\b|họ\s*tên\s*:|姓名|班级|\[chưa hỗ trợ\]|(?:i{1,3}|iv|vi{0,3}|ix|xi{0,3})\.\s*|-{2,}|={2,})/i;

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
  const drafts: ImportDraft[] = [];
  let current: ImportDraft | null = null;
  let sectionHint: QuestionType | 'SKIP' | null = null;
  let keyMode = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (ANSWER_KEY_HEADER_RE.test(line)) {
      if (current) drafts.push(current);
      current = null;
      keyMode = true;
      continue;
    }

    const section = detectSection(line);
    if (section !== undefined) {
      sectionHint = section;
      continue;
    }
    if (SKIP_RE.test(line)) continue;

    if (keyMode) {
      const keyMatch = line.match(QUESTION_RE);
      if (!keyMatch) continue;
      const answer = (keyMatch[2] ?? '').trim();
      const n = Number(keyMatch[1]);
      const target = drafts.find((d) => d.sourceNumber === n);
      if (target && answer && !target.answerRaw) target.answerRaw = answer;
      continue;
    }

    const questionMatch = line.match(QUESTION_RE);
    if (questionMatch && !OPTION_LINE_RE.test(line)) {
      if (current) drafts.push(current);
      current = emptyDraft(Number(questionMatch[1]), sectionHint, questionMatch[2] ?? '');
      continue;
    }
    if (!current) continue;
    if (applyMetaLine(current, line)) continue;

    const asOptions = splitInlineOptions(line);
    if (asOptions.options.length > 0 && (!asOptions.lead || OPTION_LINE_RE.test(line))) {
      current.options.push(...asOptions.options);
      continue;
    }
    current.promptLines.push(line);
  }
  if (current) drafts.push(current);
  return drafts.map(flushDraft).filter((q): q is ParsedDraftQuestion => q !== null);
}

function emptyDraft(sourceNumber: number, sectionHint: QuestionType | 'SKIP' | null, rest: string): ImportDraft {
  const parsedRest = splitInlineOptions(rest);
  return {
    sourceNumber,
    promptLines: parsedRest.lead ? [parsedRest.lead] : [],
    options: parsedRest.options,
    answerRaw: null,
    typeHint: null,
    sectionHint,
    points: 1,
    tokens: [],
    rubric: null,
    maxListens: null,
    pinyinSensitive: null,
  };
}

function detectSection(line: string): QuestionType | 'SKIP' | null | undefined {
  const m = line.match(SECTION_RE);
  if (!m) return undefined;
  const n = fold(m[1] ?? m[2] ?? '');
  if (/nghe|listen/.test(n)) return QuestionType.LISTENING;
  if (/viet|writ/.test(n)) return QuestionType.ESSAY;
  if (/noi|speak/.test(n)) return 'SKIP';
  return null;
}

function optionId(match: RegExpMatchArray): string {
  return (match[1] || match[2] || '').toLowerCase();
}

function splitInlineOptions(text: string): { lead: string; options: Array<{ id: string; text: string }> } {
  const matches = [...text.matchAll(INLINE_OPTION_RE)];
  if (matches.length === 0) return { lead: text.trim(), options: [] };
  const firstIndex = matches[0]!.index ?? 0;
  const lead = text.slice(0, firstIndex).trim();
  if (matches.length === 1 && lead) return { lead: text.trim(), options: [] };
  const options = matches
    .map((m, i) => {
      const start = (m.index ?? 0) + m[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length;
      return { id: optionId(m), text: text.slice(start, end).trim() };
    })
    .filter((o) => o.text);
  return { lead, options };
}

function applyMetaLine(current: ImportDraft, line: string): boolean {
  const typeMatch = line.match(TYPE_RE);
  if (typeMatch) {
    current.typeHint = parseType(typeMatch[1] ?? '') ?? current.typeHint;
    return true;
  }
  const pointsMatch = line.match(POINTS_RE);
  if (pointsMatch) {
    const rawPoints = pointsMatch[1]?.trim() ?? '';
    current.points = /^\d+(?:[.,]\d+)?$/.test(rawPoints)
      ? Number(rawPoints.replace(',', '.'))
      : Number.NaN;
    return true;
  }
  const tokensMatch = line.match(TOKENS_RE);
  if (tokensMatch) {
    current.tokens = splitTokens(tokensMatch[1] ?? '');
    return true;
  }
  const answerMatch = line.match(ANSWER_RE);
  if (answerMatch) {
    current.answerRaw = (answerMatch[1] ?? '').trim();
    return true;
  }
  if (AUDIO_RE.test(line)) {
    current.typeHint ??= QuestionType.LISTENING;
    return true;
  }
  if (IMAGE_RE.test(line)) {
    current.typeHint ??= QuestionType.IMAGE_BASED;
    return true;
  }
  const rubricMatch = line.match(RUBRIC_RE);
  if (rubricMatch) {
    current.rubric = (rubricMatch[1] ?? '').trim();
    return true;
  }
  const listensMatch = line.match(MAX_LISTENS_RE);
  if (listensMatch) {
    const n = Number(listensMatch[1]);
    current.maxListens = Number.isInteger(n) ? Math.min(20, Math.max(1, n)) : current.maxListens;
    return true;
  }
  const pinyinMatch = line.match(PINYIN_RE);
  if (pinyinMatch) {
    current.pinyinSensitive = /^(có|yes|true|1)$/i.test((pinyinMatch[1] ?? '').trim());
    return true;
  }
  return false;
}

function parseType(raw: string): QuestionType | 'SKIP' | null {
  const exact = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (exact === 'SPEAKING') return 'SKIP';
  if ((Object.values(QuestionType) as string[]).includes(exact)) return exact as QuestionType;
  const n = fold(raw);
  if (/(^noi$|speaking|khau ngu)/.test(n)) return 'SKIP';
  if (/(multiple choice|nhieu dap an|nhieu lua chon)/.test(n)) return QuestionType.MULTIPLE_CHOICE;
  if (/(fill blank|dien tu|dien cho trong)/.test(n)) return QuestionType.FILL_BLANK;
  if (/(order|sap xep)/.test(n)) return QuestionType.ORDERING;
  if (/(essay|tu luan|dich)/.test(n)) return QuestionType.ESSAY;
  if (/(listen|^nghe$|nghe hieu)/.test(n)) return QuestionType.LISTENING;
  if (/(image based|^hinh$|^anh$|hinh anh)/.test(n)) return QuestionType.IMAGE_BASED;
  if (/(single choice|trac nghiem|1 dap an)/.test(n)) return QuestionType.SINGLE_CHOICE;
  return null;
}
