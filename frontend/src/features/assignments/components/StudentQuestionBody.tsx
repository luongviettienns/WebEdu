'use client';

import React from 'react';
import type {
  SanitizedQuestionDto,
  StudentAnswerPayload,
} from '@/features/assignments/api/assignments.api';
import {
  ChoiceOptionList,
  STUDENT_ANSWER_INPUT_CLS,
  StudentImageBasedBody,
  StudentListeningBody,
} from '@/features/assignments/components/StudentQuestionMediaParts';

export interface StudentQuestionBodyProps {
  question: SanitizedQuestionDto;
  assignmentId: string;
  answer: StudentAnswerPayload | undefined;
  audioPlayCount?: number;
  readOnly?: boolean;
  onChangeAnswer?: (payload: StudentAnswerPayload) => void;
  onAudioPlay?: () => void;
}

function readSelectedIds(answer: StudentAnswerPayload | undefined): string[] {
  return answer && 'selectedOptionIds' in answer && Array.isArray(answer.selectedOptionIds)
    ? answer.selectedOptionIds
    : [];
}

function readTextValue(answer: StudentAnswerPayload | undefined): string {
  return answer && 'text' in answer && typeof answer.text === 'string' ? answer.text : '';
}

function readOrderedTokens(answer: StudentAnswerPayload | undefined): string[] {
  return answer && 'orderedTokens' in answer && Array.isArray(answer.orderedTokens)
    ? answer.orderedTokens
    : [];
}

export function StudentQuestionBody({
  question,
  assignmentId,
  answer,
  audioPlayCount = 0,
  readOnly = false,
  onChangeAnswer,
  onAudioPlay,
}: StudentQuestionBodyProps) {
  const selectedIds = readSelectedIds(answer);
  const textValue = readTextValue(answer);
  const orderedTokens = readOrderedTokens(answer);

  const emit = (payload: StudentAnswerPayload) => {
    if (!readOnly) onChangeAnswer?.(payload);
  };

  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    return (
      <ChoiceOptionList
        questionId={question.id}
        assignmentId={assignmentId}
        options={question.options ?? []}
        selectedIds={selectedIds}
        multiple={question.type === 'MULTIPLE_CHOICE'}
        readOnly={readOnly}
        onSelect={(ids) => emit({ selectedOptionIds: ids })}
      />
    );
  }

  if (question.type === 'FILL_BLANK') {
    return (
      <input
        type="text"
        className={STUDENT_ANSWER_INPUT_CLS}
        aria-label="Câu trả lời điền từ"
        placeholder="Nhập từ hoặc cụm từ còn thiếu..."
        value={textValue}
        disabled={readOnly}
        readOnly={readOnly}
        onChange={(e) => emit({ text: e.target.value })}
      />
    );
  }

  if (question.type === 'ORDERING') {
    const tokens = question.tokens ?? [];
    const consumedCounts = new Map<string, number>();
    for (const tok of orderedTokens) {
      consumedCounts.set(tok, (consumedCounts.get(tok) ?? 0) + 1);
    }
    const remainingTokens: string[] = [];
    for (const tok of tokens) {
      const count = consumedCounts.get(tok) ?? 0;
      if (count > 0) consumedCounts.set(tok, count - 1);
      else remainingTokens.push(tok);
    }

    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-2)]">
              Câu đã sắp xếp
            </span>
            {!readOnly && orderedTokens.length > 0 ? (
              <button
                type="button"
                onClick={() => emit({ orderedTokens: [] })}
                className="text-xs font-semibold text-[var(--red)] hover:underline"
              >
                Xóa hết
              </button>
            ) : null}
          </div>
          <div
            role="group"
            aria-label="Câu đã sắp xếp"
            className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--line-2)] bg-[var(--surface-2)]/60 p-3"
          >
            {orderedTokens.length === 0 ? (
              <span className="text-xs text-[var(--ink-3)]">
                Chọn các mảnh từ bên dưới theo đúng thứ tự câu...
              </span>
            ) : (
              orderedTokens.map((tok, idx) => (
                <button
                  key={`${tok}-${idx}`}
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    emit({ orderedTokens: orderedTokens.filter((_, i) => i !== idx) })
                  }
                  className="rounded-lg border border-[var(--blue)] bg-[var(--blue-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--blue)] disabled:cursor-default"
                >
                  {tok}
                </button>
              ))
            )}
          </div>
        </div>

        {!readOnly ? (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-2)]">
              Kho mảnh từ
            </span>
            <div
              role="group"
              aria-label="Kho mảnh từ"
              className="flex flex-wrap gap-2 rounded-xl border border-[var(--line)] bg-white p-3"
            >
              {remainingTokens.length === 0 ? (
                <span className="text-xs text-[var(--jade)]">Đã dùng hết mảnh từ.</span>
              ) : (
                remainingTokens.map((tok, idx) => (
                  <button
                    key={`${tok}-${idx}`}
                    type="button"
                    onClick={() => emit({ orderedTokens: [...orderedTokens, tok] })}
                    className="rounded-lg border border-[var(--line-2)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:border-[var(--blue)] hover:bg-[var(--hover)]"
                  >
                    {tok}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (question.type === 'ESSAY') {
    const maxLen = question.maxLength;
    return (
      <div className="space-y-1.5">
        <textarea
          rows={5}
          className={STUDENT_ANSWER_INPUT_CLS}
          aria-label="Bài viết tự luận"
          placeholder="Nhập câu trả lời tự luận của bạn..."
          maxLength={maxLen}
          value={textValue}
          disabled={readOnly}
          readOnly={readOnly}
          onChange={(e) => emit({ text: e.target.value })}
        />
        <div className="num text-right text-xs text-[var(--ink-3)]">
          {maxLen ? `${textValue.length} / ${maxLen} ký tự` : `${textValue.length} ký tự`}
        </div>
      </div>
    );
  }

  if (question.type === 'LISTENING') {
    return (
      <StudentListeningBody
        question={question}
        assignmentId={assignmentId}
        selectedIds={selectedIds}
        textValue={textValue}
        audioPlayCount={audioPlayCount}
        readOnly={readOnly}
        onChangeAnswer={emit}
        onAudioPlay={onAudioPlay}
      />
    );
  }

  return (
    <StudentImageBasedBody
      question={question}
      assignmentId={assignmentId}
      selectedIds={selectedIds}
      textValue={textValue}
      readOnly={readOnly}
      onChangeAnswer={emit}
    />
  );
}
