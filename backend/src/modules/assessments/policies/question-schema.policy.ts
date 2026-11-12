import { BadRequestException, Injectable } from '@nestjs/common';
import { QuestionType } from '@prisma/client';

type Option = { id: string; text: string };

function optionsOf(payload: Record<string, unknown>): Option[] {
  return Array.isArray(payload.options)
    ? (payload.options as Option[]).filter((o) => typeof o?.id === 'string')
    : [];
}

@Injectable()
export class QuestionSchemaPolicy {
  validatePayload(type: QuestionType, payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    switch (type) {
      case QuestionType.SINGLE_CHOICE:
        this.validateChoice(optionsOf(p), p, 1, 1);
        return;
      case QuestionType.MULTIPLE_CHOICE:
        this.validateChoice(optionsOf(p), p, 2, 4);
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
        return;
      }
      case QuestionType.ESSAY:
        return;
      case QuestionType.LISTENING:
      case QuestionType.IMAGE_BASED: {
        if (typeof p.mediaId !== 'string' || !p.mediaId.trim()) {
          throw new BadRequestException('Dạng câu này yêu cầu mediaId');
        }
        return;
      }
    }
  }

  private validateChoice(options: Option[], p: Record<string, unknown>, minCorrect: number, _maxOptions: number): void {
    if (options.length < 2 || options.length > 4) {
      throw new BadRequestException('Trắc nghiệm cần 2–4 phương án');
    }
    const correct = Array.isArray(p.correctOptionIds) ? (p.correctOptionIds as unknown[]) : [];
    const ids = new Set(options.map((o) => o.id));
    const valid = correct.filter((c) => typeof c === 'string' && ids.has(c));
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
