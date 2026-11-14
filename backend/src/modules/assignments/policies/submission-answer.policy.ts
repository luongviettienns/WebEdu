import { BadRequestException, Injectable } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import type {
  SanitizedOptionDto,
  SanitizedQuestionDto,
  StudentAnswerPayload,
} from '../assignments.types.js';
import {
  compareLex,
  extractOptions,
  extractTokens,
  hasUsableOptionContent,
  isAnswerNonEmpty,
  isRecord,
  matchesSequence,
  shuffleTokensDeterministically,
} from './submission-payload.util.js';

export { isAnswerNonEmpty };

const DEFAULT_MAX_TEXT_LENGTH = 10_000;

const resolvePositiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

@Injectable()
export class SubmissionAnswerPolicy {
  sanitizeQuestionForStudent(
    question: {
      id: string;
      position: number;
      type: QuestionType;
      prompt: string;
      points: number;
      payload: unknown;
    },
    seedKey: string,
  ): SanitizedQuestionDto {
    const p = isRecord(question.payload) ? question.payload : {};
    const base: SanitizedQuestionDto = {
      id: question.id,
      position: question.position,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
    };
    switch (question.type) {
      case QuestionType.SINGLE_CHOICE:
      case QuestionType.MULTIPLE_CHOICE:
        return { ...base, options: extractOptions(p) };
      case QuestionType.FILL_BLANK:
        return base;
      case QuestionType.ORDERING:
        return {
          ...base,
          tokens: shuffleTokensDeterministically(
            extractTokens(p),
            `${seedKey}:${question.id}`,
            typeof p.correctSentence === 'string' ? p.correctSentence : undefined,
          ),
        };
      case QuestionType.ESSAY: {
        const maxLength = resolvePositiveInt(p.maxLength);
        return { ...base, ...(maxLength !== undefined ? { maxLength } : {}) };
      }
      case QuestionType.LISTENING:
      case QuestionType.IMAGE_BASED: {
        const options = extractOptions(p);
        return {
          ...base,
          ...(typeof p.mediaId === 'string' && p.mediaId.trim() ? { mediaId: p.mediaId } : {}),
          ...(question.type === QuestionType.LISTENING && typeof p.maxListens === 'number'
            ? { maxListens: p.maxListens }
            : {}),
          ...(question.type === QuestionType.IMAGE_BASED && typeof p.caption === 'string'
            ? { caption: p.caption }
            : {}),
          ...(typeof p.multiple === 'boolean' ? { multiple: p.multiple } : {}),
          ...(hasUsableOptionContent(options) ? { options } : {}),
        };
      }
    }
  }

  validateStudentAnswer(
    question: { id: string; type: QuestionType; payload: unknown },
    answerPayload: Record<string, unknown>,
    existingAudioPlayCount: number,
    requestedAudioPlayCount?: number,
  ): { normalizedPayload: StudentAnswerPayload; nextAudioPlayCount: number } {
    if (!isRecord(answerPayload)) throw new BadRequestException('Đáp án phải là object hợp lệ');
    const p = isRecord(question.payload) ? question.payload : {};
    return {
      normalizedPayload: this.validatePayloadByType(question.type, p, answerPayload),
      nextAudioPlayCount: this.resolveNextAudioPlayCount(
        question.type,
        p,
        existingAudioPlayCount,
        requestedAudioPlayCount,
      ),
    };
  }

  isAnswerNonEmpty(answerPayload: unknown): boolean {
    return isAnswerNonEmpty(answerPayload);
  }

  private resolveNextAudioPlayCount(
    type: QuestionType,
    payload: Record<string, unknown>,
    existingCount: number,
    requestedCount?: number,
  ): number {
    const nextCount = requestedCount ?? existingCount;
    if (!Number.isInteger(nextCount) || nextCount < 0) {
      throw new BadRequestException('Số lượt nghe phải là số nguyên không âm');
    }
    if (nextCount < existingCount) {
      throw new BadRequestException('Số lượt nghe không được nhỏ hơn số lượt đã ghi nhận');
    }
    if (
      type === QuestionType.LISTENING &&
      typeof payload.maxListens === 'number' &&
      payload.maxListens > 0 &&
      nextCount > payload.maxListens
    ) {
      throw new BadRequestException('Đã hết lượt nghe cho phép');
    }
    return nextCount;
  }

  private validatePayloadByType(
    type: QuestionType,
    questionPayload: Record<string, unknown>,
    answerPayload: Record<string, unknown>,
  ): StudentAnswerPayload {
    switch (type) {
      case QuestionType.SINGLE_CHOICE:
        return this.validateOptionSelection(extractOptions(questionPayload), answerPayload, false);
      case QuestionType.MULTIPLE_CHOICE:
        return this.validateOptionSelection(extractOptions(questionPayload), answerPayload, true);
      case QuestionType.FILL_BLANK:
      case QuestionType.ESSAY: {
        const maxLength = resolvePositiveInt(questionPayload.maxLength) ?? DEFAULT_MAX_TEXT_LENGTH;
        return this.validateTextAnswer(answerPayload, maxLength);
      }
      case QuestionType.ORDERING:
        return this.validateOrderingAnswer(extractTokens(questionPayload), answerPayload);
      case QuestionType.LISTENING:
      case QuestionType.IMAGE_BASED: {
        const options = extractOptions(questionPayload);
        return hasUsableOptionContent(options)
          ? this.validateOptionSelection(options, answerPayload, questionPayload.multiple === true)
          : this.validateTextAnswer(answerPayload, DEFAULT_MAX_TEXT_LENGTH);
      }
    }
  }

  private validateOptionSelection(
    options: readonly SanitizedOptionDto[],
    answerPayload: Record<string, unknown>,
    allowMultiple: boolean,
  ): StudentAnswerPayload {
    const raw = answerPayload.selectedOptionIds;
    if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string')) {
      throw new BadRequestException('selectedOptionIds phải là mảng chuỗi hợp lệ');
    }
    if (!allowMultiple && raw.length > 1) {
      throw new BadRequestException('Câu hỏi này chỉ cho phép chọn tối đa 1 đáp án');
    }
    if (new Set(raw).size !== raw.length) {
      throw new BadRequestException('Danh sách phương án đã chọn không được trùng lặp');
    }
    const validIds = new Set(options.map((opt) => opt.id));
    if (raw.some((id) => !validIds.has(id))) {
      throw new BadRequestException('Phương án đã chọn không tồn tại trong câu hỏi');
    }
    return { selectedOptionIds: [...raw] };
  }

  private validateTextAnswer(
    answerPayload: Record<string, unknown>,
    maxLength: number,
  ): StudentAnswerPayload {
    if (typeof answerPayload.text !== 'string') {
      throw new BadRequestException('Nội dung trả lời phải là chuỗi ký tự');
    }
    if (answerPayload.text.length > maxLength) {
      throw new BadRequestException(`Nội dung trả lời vượt quá giới hạn ${maxLength} ký tự`);
    }
    return { text: answerPayload.text };
  }

  private validateOrderingAnswer(
    questionTokens: readonly string[],
    answerPayload: Record<string, unknown>,
  ): StudentAnswerPayload {
    const raw = answerPayload.orderedTokens;
    if (!Array.isArray(raw) || raw.some((token) => typeof token !== 'string')) {
      throw new BadRequestException('orderedTokens phải là mảng chuỗi hợp lệ');
    }
    if (raw.length === 0) return { orderedTokens: [] };
    if (!matchesSequence([...raw].sort(compareLex), [...questionTokens].sort(compareLex))) {
      throw new BadRequestException('Danh sách mảnh từ không khớp với câu hỏi');
    }
    return { orderedTokens: [...raw] };
  }
}
