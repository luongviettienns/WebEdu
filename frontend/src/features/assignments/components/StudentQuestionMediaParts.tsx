'use client';

import Image from 'next/image';
import React, { useEffect, useRef } from 'react';
import {
  getAssignmentMediaUrl,
  type SanitizedOptionDto,
  type SanitizedQuestionDto,
  type StudentAnswerPayload,
} from '@/features/assignments/api/assignments.api';

export const STUDENT_ANSWER_INPUT_CLS =
  'w-full rounded-lg border border-[var(--line-2)] bg-white px-3.5 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--blue)] focus:outline-none disabled:bg-[var(--surface-2)] disabled:text-[var(--ink-2)]';

export function ChoiceOptionList({
  questionId,
  assignmentId,
  options,
  selectedIds,
  multiple,
  readOnly,
  onSelect,
}: {
  questionId: string;
  assignmentId: string;
  options: readonly SanitizedOptionDto[];
  selectedIds: readonly string[];
  multiple: boolean;
  readOnly: boolean;
  onSelect: (nextIds: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (readOnly) return;
    if (!multiple) {
      onSelect([id]);
      return;
    }
    onSelect(
      selectedIds.includes(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <fieldset className="space-y-2.5">
      <legend className="sr-only">Chọn đáp án</legend>
      {options.map((opt, idx) => {
        const checked = selectedIds.includes(opt.id);
        const letter = String.fromCharCode(65 + idx);
        return (
          <label
            key={opt.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
              checked
                ? 'border-[var(--blue)] bg-[var(--blue-soft)]/50'
                : 'border-[var(--line)] bg-white hover:bg-[var(--hover)]'
            } ${readOnly ? 'cursor-default opacity-90' : ''}`}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={`question-${questionId}`}
              checked={checked}
              disabled={readOnly}
              onChange={() => toggle(opt.id)}
              className="mt-0.5 h-4 w-4 accent-[var(--blue)]"
            />
            <span className="font-num w-6 shrink-0 font-bold text-[var(--ink-2)]">{letter}.</span>
            <span className="min-w-0 flex-1 space-y-2">
              {opt.text ? <span className="block text-[var(--ink)]">{opt.text}</span> : null}
              {opt.imageMediaId ? (
                <Image
                  src={getAssignmentMediaUrl(assignmentId, opt.imageMediaId)}
                  alt={opt.text || `Phương án ${letter}`}
                  width={260}
                  height={160}
                  unoptimized
                  crossOrigin="use-credentials"
                  className="max-h-36 w-auto rounded-lg border border-[var(--line)] object-contain"
                />
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function StudentListeningBody({
  question,
  assignmentId,
  selectedIds,
  textValue,
  audioPlayCount,
  readOnly,
  onChangeAnswer,
  onAudioPlay,
}: {
  question: SanitizedQuestionDto;
  assignmentId: string;
  selectedIds: string[];
  textValue: string;
  audioPlayCount: number;
  readOnly: boolean;
  onChangeAnswer: (payload: StudentAnswerPayload) => void;
  onAudioPlay?: () => void;
}) {
  const countedPlayRef = useRef(false);

  useEffect(() => {
    countedPlayRef.current = false;
  }, [question.id]);

  const maxListens = question.maxListens;
  const isLimitReached =
    typeof maxListens === 'number' && maxListens > 0 && audioPlayCount >= maxListens;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--ink-2)]">File nghe</span>
          <span className="num rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-[var(--ink)]">
            {maxListens
              ? `Đã nghe ${audioPlayCount} / ${maxListens} lượt`
              : `Đã nghe ${audioPlayCount} lượt`}
          </span>
        </div>
        {question.mediaId ? (
          <audio
            controls
            controlsList="nodownload"
            preload="none"
            crossOrigin="use-credentials"
            src={getAssignmentMediaUrl(assignmentId, question.mediaId)}
            className="w-full"
            onPlay={(e) => {
              if (!readOnly && isLimitReached) {
                e.currentTarget.pause();
              }
            }}
            onPlaying={() => {
              if (readOnly || isLimitReached) return;
              if (!countedPlayRef.current) {
                countedPlayRef.current = true;
                onAudioPlay?.();
              }
            }}
            onEnded={() => {
              countedPlayRef.current = false;
            }}
          />
        ) : (
          <p className="text-xs text-[var(--ink-3)]">Không có file âm thanh đính kèm.</p>
        )}
        {!readOnly && isLimitReached ? (
          <p className="text-xs font-medium text-[var(--red-ink)]">
            Đã hết lượt nghe cho phép cho câu hỏi này.
          </p>
        ) : null}
      </div>
      {question.options && question.options.length > 0 ? (
        <ChoiceOptionList
          questionId={question.id}
          assignmentId={assignmentId}
          options={question.options}
          selectedIds={selectedIds}
          multiple={Boolean(question.multiple)}
          readOnly={readOnly}
          onSelect={(ids) => onChangeAnswer({ selectedOptionIds: ids })}
        />
      ) : (
        <input
          type="text"
          className={STUDENT_ANSWER_INPUT_CLS}
          aria-label="Câu trả lời phần nghe"
          placeholder="Nhập nội dung nghe được..."
          value={textValue}
          disabled={readOnly}
          readOnly={readOnly}
          onChange={(e) => onChangeAnswer({ text: e.target.value })}
        />
      )}
    </div>
  );
}

export function StudentImageBasedBody({
  question,
  assignmentId,
  selectedIds,
  textValue,
  readOnly,
  onChangeAnswer,
}: {
  question: SanitizedQuestionDto;
  assignmentId: string;
  selectedIds: string[];
  textValue: string;
  readOnly: boolean;
  onChangeAnswer: (payload: StudentAnswerPayload) => void;
}) {
  return (
    <div className="space-y-4">
      {question.mediaId ? (
        <div className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 p-3">
          <Image
            src={getAssignmentMediaUrl(assignmentId, question.mediaId)}
            alt={question.caption || `Hình minh họa câu ${question.position}`}
            width={640}
            height={360}
            unoptimized
            crossOrigin="use-credentials"
            className="max-h-72 w-auto rounded-lg border border-[var(--line)] bg-white object-contain"
          />
          {question.caption ? (
            <p className="text-xs italic text-[var(--ink-2)]">{question.caption}</p>
          ) : null}
        </div>
      ) : null}
      {question.options && question.options.length > 0 ? (
        <ChoiceOptionList
          questionId={question.id}
          assignmentId={assignmentId}
          options={question.options}
          selectedIds={selectedIds}
          multiple={Boolean(question.multiple)}
          readOnly={readOnly}
          onSelect={(ids) => onChangeAnswer({ selectedOptionIds: ids })}
        />
      ) : (
        <input
          type="text"
          className={STUDENT_ANSWER_INPUT_CLS}
          aria-label="Câu trả lời hình ảnh"
          placeholder="Nhập câu trả lời của bạn..."
          value={textValue}
          disabled={readOnly}
          readOnly={readOnly}
          onChange={(e) => onChangeAnswer({ text: e.target.value })}
        />
      )}
    </div>
  );
}
