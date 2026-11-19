import type { QuestionType } from '../../assessments/api/assessments.api';
import type { AssignmentDisplayStatus } from '../../assignments/api/assignments.api';
import { formatDateDdMmYyyy } from '../../../lib/utils/date';
import type { GradingTrackerStudentRowDto } from '../api/grading.api';

/**
 * Cổng Zero-Leak: Chỉ trả về true khi bài nộp đã ở trạng thái RETURNED (Đã công bố).
 * Tuyệt đối ẩn điểm khi bài đang SUBMITTED_WAITING, AUTO_GRADED_PENDING_REVIEW hoặc GRADED.
 */
export function isStudentScoreVisible(status: AssignmentDisplayStatus): boolean {
  return status === 'RETURNED';
}

export function isWaitingForTeacherGrading(status: AssignmentDisplayStatus): boolean {
  return (
    status === 'SUBMITTED_WAITING' ||
    status === 'AUTO_GRADED_PENDING_REVIEW' ||
    status === 'GRADED'
  );
}

export function formatUpdatedGradeBadge(gradeUpdatedAt?: string | null): string | null {
  if (!gradeUpdatedAt || !gradeUpdatedAt.trim()) return null;
  return `Đã cập nhật ${formatDateDdMmYyyy(gradeUpdatedAt)}`;
}

export function getTrackerRowBadge(row: GradingTrackerStudentRowDto): {
  label: string;
  tone: 'jade' | 'amber' | 'blue' | 'red' | 'grey';
} {
  if (row.status === 'RETURNED') {
    return { label: 'Đã công bố điểm', tone: 'jade' };
  }
  if (row.status === 'GRADED') {
    return { label: 'Đã xác nhận (Chưa công bố)', tone: 'blue' };
  }
  if (row.status === 'SUBMITTED_WAITING' || row.status === 'AUTO_GRADED_PENDING_REVIEW') {
    return row.ungradedSubjectiveCount > 0
      ? { label: `Cần chấm (${row.ungradedSubjectiveCount} tự luận)`, tone: 'amber' }
      : { label: 'Chờ xác nhận điểm', tone: 'amber' };
  }
  if (row.isOverdueNotSubmitted) {
    return { label: 'Quá hạn chưa nộp', tone: 'red' };
  }
  if (row.status === 'IN_PROGRESS') {
    return { label: 'Đang làm dở', tone: 'blue' };
  }
  return { label: 'Chưa làm', tone: 'grey' };
}

export interface SelectedOptionDisplayItem {
  id: string;
  letter: string;
  text: string;
  imageMediaId: string | null;
}

function formatOptionLetter(index: number): string {
  return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

export function extractSelectedOptionItems(
  ids: unknown,
  questionPayload?: Record<string, unknown> | null,
): SelectedOptionDisplayItem[] {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const rawOptions = Array.isArray(questionPayload?.options) ? questionPayload.options : [];
  const optionMap = new Map<string, SelectedOptionDisplayItem>();
  rawOptions.forEach((opt, idx) => {
    if (!opt || typeof opt !== 'object' || !('id' in opt)) return;
    const record = opt as { id?: unknown; text?: unknown; imageMediaId?: unknown };
    const id = String(record.id);
    const text = typeof record.text === 'string' ? record.text.trim() : '';
    const imageMediaId =
      typeof record.imageMediaId === 'string' && record.imageMediaId.trim()
        ? record.imageMediaId.trim()
        : null;
    optionMap.set(id, { id, letter: formatOptionLetter(idx), text, imageMediaId });
  });

  return ids.map((rawId) => {
    const id = String(rawId);
    return optionMap.get(id) ?? { id, letter: '', text: '', imageMediaId: null };
  });
}

export function formatOptionTexts(
  ids: unknown,
  questionPayload?: Record<string, unknown> | null,
): string {
  const items = extractSelectedOptionItems(ids, questionPayload);
  if (items.length === 0) return '— (Không chọn)';
  return items
    .map((item) => {
      if (item.letter && item.text) return `${item.letter}. ${item.text}`;
      if (item.letter && item.imageMediaId) return `${item.letter}. (Hình ảnh)`;
      if (item.letter) return `Phương án ${item.letter}`;
      return item.text || item.id;
    })
    .join(', ');
}

export function formatAnswerPayloadText(
  type: QuestionType,
  answerPayload: Record<string, unknown>,
  questionPayload?: Record<string, unknown> | null,
): string {
  if (
    type === 'SINGLE_CHOICE' ||
    type === 'MULTIPLE_CHOICE' ||
    type === 'LISTENING' ||
    type === 'IMAGE_BASED'
  ) {
    if (Array.isArray(answerPayload.selectedOptionIds)) {
      return formatOptionTexts(answerPayload.selectedOptionIds, questionPayload);
    }
  }
  if (type === 'ORDERING' && Array.isArray(answerPayload.orderedTokens)) {
    return answerPayload.orderedTokens.length > 0
      ? answerPayload.orderedTokens.map(String).join(' ')
      : '— (Bỏ trống)';
  }
  if (typeof answerPayload.text === 'string') {
    return answerPayload.text.trim() || '— (Bỏ trống)';
  }
  return '— (Bỏ trống)';
}

export function formatCorrectAnswerText(
  type: QuestionType,
  payload: Record<string, unknown> | null,
): string {
  if (!payload) return '—';
  if (Array.isArray(payload.correctOptionIds)) {
    return formatOptionTexts(payload.correctOptionIds, payload);
  }
  if (Array.isArray(payload.acceptedAnswers) && payload.acceptedAnswers.length > 0) {
    return payload.acceptedAnswers.map(String).join(' / ');
  }
  if (typeof payload.correctSentence === 'string' && payload.correctSentence.trim()) {
    return payload.correctSentence.trim();
  }
  if (type === 'ESSAY') {
    return typeof payload.sampleAnswer === 'string' && payload.sampleAnswer.trim()
      ? payload.sampleAnswer.trim()
      : 'Theo rubric của giáo viên';
  }
  return '—';
}
