import { BadRequestException, Injectable } from '@nestjs/common';
import { QuestionType } from '@prisma/client';

type Option = { id: string; text: string; imageMediaId?: string };

function optionsOf(payload: Record<string, unknown>): Option[] {
  return Array.isArray(payload.options)
    ? (payload.options as Option[]).filter((o) => typeof o?.id === 'string')
    : [];
}

@Injectable()
export class QuestionSchemaPolicy {
  validatePayload(type: QuestionType, payload: unknown): void {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new BadRequestException('payload phải là object hợp lệ');
    }
    const p = payload as Record<string, unknown>;
    if (JSON.stringify(p).length > 32_768) {
      throw new BadRequestException('payload vượt quá 32KB');
    }
    switch (type) {
      case QuestionType.SINGLE_CHOICE:
        this.validateChoice(optionsOf(p), p, 1, true);
        return;
      case QuestionType.MULTIPLE_CHOICE:
        this.validateChoice(optionsOf(p), p, 2, true);
        return;
      case QuestionType.FILL_BLANK: {
        const answers = Array.isArray(p.acceptedAnswers)
          ? (p.acceptedAnswers as unknown[]).filter((a) => typeof a === 'string' && a.trim())
          : [];
        if (answers.length === 0) throw new BadRequestException('Câu điền từ cần ít nhất 1 đáp án chấp nhận');
        return;
      }
      case QuestionType.ORDERING: {
        const tokens = Array.isArray(p.tokens)
          ? (p.tokens as unknown[]).filter((t) => typeof t === 'string' && t.trim())
          : [];
        if (tokens.length < 2) throw new BadRequestException('Câu sắp xếp cần ít nhất 2 mảnh từ');
        if (typeof p.correctSentence !== 'string' || !p.correctSentence.trim()) {
          throw new BadRequestException('Câu sắp xếp cần nhập câu đáp án đúng');
        }
        return;
      }
      case QuestionType.ESSAY: {
        this.assertOptionalIntRange(p.maxLength, 1, 50_000, 'Giới hạn ký tự phải là số nguyên từ 1 đến 50000');
        this.assertOptionalString(p.sampleAnswer, 'Đáp án mẫu phải là chuỗi');
        this.assertOptionalString(p.rubric, 'Rubric phải là chuỗi');
        return;
      }
      case QuestionType.LISTENING: {
        if (typeof p.mediaId !== 'string' || !p.mediaId.trim()) {
          throw new BadRequestException('Dạng câu này yêu cầu mediaId');
        }
        this.assertOptionalIntRange(p.maxListens, 1, 20, 'Số lần nghe tối đa phải là số nguyên từ 1 đến 20');
        return;
      }
      case QuestionType.IMAGE_BASED: {
        const options = optionsOf(p);
        const stem = typeof p.mediaId === 'string' ? p.mediaId.trim() : '';
        const optionImages = options.filter((o) => o.imageMediaId?.trim());
        if (!stem && optionImages.length < 2) {
          throw new BadRequestException('Câu kèm hình cần ảnh đề hoặc ít nhất 2 phương án ảnh');
        }
        const hasOptionContent = options.some((o) => o.text?.trim() || o.imageMediaId?.trim());
        if (hasOptionContent) this.validateChoice(options, p, 1, false);
        return;
      }
    }
  }

  private assertOptionalIntRange(value: unknown, min: number, max: number, message: string): void {
    if (value === undefined || value === null) return;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new BadRequestException(message);
    }
  }

  private assertOptionalString(value: unknown, message: string): void {
    if (value === undefined || value === null) return;
    if (typeof value !== 'string') {
      throw new BadRequestException(message);
    }
  }

  private validateChoice(
    options: Option[],
    p: Record<string, unknown>,
    minCorrect: number,
    requireContent: boolean,
  ): void {
    if (options.length < 2 || options.length > 4) {
      throw new BadRequestException('Trắc nghiệm cần 2–4 phương án');
    }
    if (requireContent && options.some((o) => !o.text?.trim() && !o.imageMediaId?.trim())) {
      throw new BadRequestException('Mỗi phương án cần có nội dung hoặc ảnh');
    }
    const optionIds = options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new BadRequestException('Phương án không được trùng id');
    }
    const correct = Array.isArray(p.correctOptionIds) ? (p.correctOptionIds as unknown[]) : [];
    const ids = new Set(optionIds);
    const valid = correct.filter((c) => typeof c === 'string' && ids.has(c));
    if (new Set(valid).size !== valid.length) {
      throw new BadRequestException('correctOptionIds không được trùng');
    }
    if (valid.length !== correct.length || valid.length < minCorrect || valid.length > options.length) {
      throw new BadRequestException('correctOptionIds phải trỏ tới phương án hợp lệ');
    }
    if (minCorrect === 1 && valid.length !== 1) {
      throw new BadRequestException('Trắc nghiệm 1 đáp án chỉ chọn đúng 1 phương án');
    }
    if (minCorrect > 1 && valid.length < 2) {
      throw new BadRequestException('Trắc nghiệm nhiều đáp án cần chọn ít nhất 2 đáp án đúng');
    }
  }
}
