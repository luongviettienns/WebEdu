import { BadRequestException } from '@nestjs/common';
import type { AiEssayGradingInput } from '../grading.types.js';

const UB_START = String.raw`(?<![\p{L}\p{M}\p{N}])`;
const UB_END = String.raw`(?![\p{L}\p{M}\p{N}])`;

const EMAIL_RE =
  /[\p{L}\p{M}\p{N}._%+-]+@(?:[\p{L}\p{M}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{M}\p{N}])?\.)+[\p{L}\p{M}\p{N}-]{2,63}/gu;
const UNREDACTED_EMAIL_LIKE_RE = /\S+@\S+/u;
const LABELED_ID_RE = new RegExp(
  `${UB_START}(?:CCCD|CMND|MSSV|MSHV|SBD|PASSPORT)\\s*[:#-]?\\s*[A-Z0-9-]{5,20}${UB_END}`,
  'giu',
);
const NATIONAL_ID_12_RE = /(?<!\d)\d{12}(?!\d)/g;
const PHONE_CANDIDATE_RE =
  /(?<!\d)(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?!\d)/g;

const CAPITALIZED_SELF_IDENT_RE = new RegExp(
  `${UB_START}(?:Tôi|tôi|Em|em|Mình|mình|Tớ|tớ)\\s+là\\s+\\p{Lu}\\p{Ll}+(?:\\s+\\p{Lu}\\p{Ll}+){0,4}${UB_END}`,
  'u',
);

const UNVERIFIABLE_PII_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  {
    label: 'nội dung tự giới thiệu',
    regex: new RegExp(
      `(?:${UB_START}(?:giới\\s+thiệu\\s+bản\\s+thân|tự\\s+giới\\s+thiệu|introduce\\s+yourself)${UB_END}|自我介绍)`,
      'iu',
    ),
  },
  {
    label: 'tên cá nhân',
    regex: new RegExp(
      `(?:${UB_START}(?:họ\\s+(?:và\\s+)?tên|tên\\s+(?:của\\s+)?(?:em|tôi|tớ|mình|con|cháu|bạn)\\s+là|(?:em|tôi|tớ|mình|con|cháu)\\s+(?:có\\s+)?tên\\s+(?:là\\s+)?\\p{L}+|my\\s+name\\s+is)${UB_END}|我叫\\s*[\\p{Script=Han}A-Za-z]|我姓\\s*[\\p{Script=Han}]|我的名字(?:是|叫)|(?:^|[\\n\\r;,])\\s*(?:họ\\s*(?:và\\s*)?tên|full\\s*name|student\\s*name|姓名)\\s*[:：])`,
      'imu',
    ),
  },
  {
    label: 'tên cá nhân',
    regex: CAPITALIZED_SELF_IDENT_RE,
  },
  {
    label: 'ngày sinh cá nhân',
    regex: new RegExp(
      `(?:${UB_START}(?:ngày\\s+sinh|date\\s+of\\s+birth|born\\s+on)${UB_END}|出生日期|我的生日|我出生于)\\s*(?:là|is|是|[:：])?\\s*\\d`,
      'iu',
    ),
  },
  {
    label: 'địa chỉ cá nhân',
    regex: new RegExp(
      `(?:${UB_START}(?:địa\\s+chỉ(?:\\s+(?:nhà|riêng|thường\\s+trú|tạm\\s+trú|liên\\s+hệ|cư\\s+trú))?|(?:nhà|gia\\s+đình)\\s+(?:em|tôi|tớ|mình)\\s+(?:ở|tại)|(?:em|tôi|tớ|mình)\\s+(?:đang\\s+)?(?:ở|sống|trú|cư\\s+trú|tạm\\s+trú|thường\\s+trú|ngụ)\\s+(?:tại|ở)\\s+(?:\\d+|số|ngõ|ngách|hẻm|đường|phố|khu|xóm|thôn|ấp|phường|xã|quận|huyện|thị|tỉnh|thành\\s+phố|tại|nhà)|(?:số\\s+nhà|ngõ|ngách|hẻm)\\s+\\d+[\\p{L}\\d/-]*|(?:số\\s+\\d+(?:/\\d+)?|đầu\\s+đường)\\s+(?:đường|phố)\\s+[\\p{L}\\d\\s]{2,40}|(?:phường|xã|thị\\s+trấn|thôn|xóm|ấp|khu\\s+phố|tổ\\s+dân\\s+phố)\\s+[\\p{L}\\d\\s.]{1,35},?\\s*(?:quận|huyện|thị\\s+xã|thành\\s+phố|tp\\.?|tỉnh)|(?:quận|huyện|thị\\s+xã)\\s+[\\p{L}\\d\\s.]{1,30},?\\s*(?:thành\\s+phố|tp\\.?|tỉnh)|i\\s+(?:live|reside)\\s+at\\s+\\d+)${UB_END}|家庭住址|我的住址|联系地址|住在.{0,15}(?:路|街|巷|弄|号|小区|公寓|村)|(?:^|[\\n\\r;,])\\s*(?:địa\\s*chỉ|nơi\\s*ở|chỗ\\s*ở|address|home\\s*address|住址)\\s*[:：])`,
      'imu',
    ),
  },
];

function normalizeForPiiInspection(text: string): string {
  return text.normalize('NFKC').replace(/\uFF20/g, '@');
}

export class ZeroPiiManualGradingRequiredException extends BadRequestException {
  constructor(detail: string) {
    super(
      `Phát hiện ${detail} trong nội dung chấm tự luận nên chưa thể xác nhận khử định danh hoàn toàn (Zero-PII). Vui lòng chấm tay câu này.`,
    );
  }
}

export function scrubDeterministicPii(text: string): string {
  return normalizeForPiiInspection(text)
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(LABELED_ID_RE, '[REDACTED_ID]')
    .replace(NATIONAL_ID_12_RE, '[REDACTED_ID]')
    .replace(PHONE_CANDIDATE_RE, (candidate) => {
      const digits = candidate.replace(/\D/g, '');
      if (digits.length >= 9 && digits.length <= 15) {
        return '[REDACTED_PHONE]';
      }
      return candidate;
    });
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertNoUnverifiablePii(
  fieldName: string,
  text: string,
  forbiddenNames?: readonly string[],
): void {
  if (!text) return;
  const normalized = normalizeForPiiInspection(text);

  for (const rule of UNVERIFIABLE_PII_PATTERNS) {
    if (rule.regex.test(normalized)) {
      throw new ZeroPiiManualGradingRequiredException(`${rule.label} ở trường ${fieldName}`);
    }
  }

  if (forbiddenNames && forbiddenNames.length > 0) {
    const normalizedLower = normalized.toLocaleLowerCase('vi-VN');
    for (const rawName of forbiddenNames) {
      const cleanName = normalizeForPiiInspection(rawName).trim();
      if (cleanName.length >= 2) {
        const boundaryNameRe = new RegExp(
          `${UB_START}${escapeRegExp(cleanName)}${UB_END}`,
          'iu',
        );
        const containsHanName = /\p{Script=Han}/u.test(cleanName) && normalized.includes(cleanName);
        if (containsHanName || boundaryNameRe.test(normalized)) {
          throw new ZeroPiiManualGradingRequiredException(`tên định danh ở trường ${fieldName}`);
        }
        const parts = cleanName.split(/\s+/).filter(Boolean);
        if (parts.length >= 3) {
          const lastTwo = parts.slice(-2).join(' ');
          if (lastTwo.length >= 4 && normalizedLower.includes(lastTwo.toLocaleLowerCase('vi-VN'))) {
            throw new ZeroPiiManualGradingRequiredException(`tên định danh ở trường ${fieldName}`);
          }
        }
      }
    }
  }
}

function scrubAndVerifyField(fieldName: string, rawValue: string): string {
  const scrubbed = scrubDeterministicPii(rawValue);
  if (UNREDACTED_EMAIL_LIKE_RE.test(scrubbed)) {
    throw new ZeroPiiManualGradingRequiredException(
      `chuỗi giống email chưa thể khử định danh hoàn toàn ở trường ${fieldName}`,
    );
  }
  return scrubbed;
}

export function sanitizeAndVerifyEssayDraftInput(
  input: AiEssayGradingInput,
  forbiddenNames?: readonly string[],
): AiEssayGradingInput {
  const fields: Array<{ name: string; value: string | null }> = [
    { name: 'prompt', value: input.prompt },
    { name: 'sampleAnswer', value: input.sampleAnswer },
    { name: 'rubric', value: input.rubric },
    { name: 'studentAnswer', value: input.studentAnswer },
  ];

  for (const field of fields) {
    if (field.value) {
      assertNoUnverifiablePii(field.name, field.value, forbiddenNames);
    }
  }

  return {
    prompt: scrubAndVerifyField('prompt', input.prompt),
    maxPoints: input.maxPoints,
    sampleAnswer:
      input.sampleAnswer !== null ? scrubAndVerifyField('sampleAnswer', input.sampleAnswer) : null,
    rubric: input.rubric !== null ? scrubAndVerifyField('rubric', input.rubric) : null,
    studentAnswer: scrubAndVerifyField('studentAnswer', input.studentAnswer),
  };
}
