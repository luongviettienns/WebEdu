import { BadRequestException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { formatDateTimeVn, formatDateVn } from '../../../common/utils/timezone.util.js';

const SAFE_INTERNAL_LINK_PATH_RE = /^\/([^/\\]|$)/;

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export type BuildNotificationContentInput =
  | {
      type: typeof NotificationType.NEW_STUDENT_PENDING_CLASS;
      studentName: string;
    }
  | {
      type: typeof NotificationType.STUDENT_ENROLLED;
      classCode: string;
    }
  | {
      type: typeof NotificationType.STUDENT_TRANSFERRED;
      sourceClassCode: string;
      targetClassCode: string;
    }
  | {
      type: typeof NotificationType.STUDENT_DROPPED;
      classCode: string;
    }
  | {
      type: typeof NotificationType.TEACHER_ASSIGNED_CLASS;
      classCode: string;
      courseName: string;
      isReassignment?: boolean;
    }
  | {
      type: typeof NotificationType.SESSION_RESCHEDULED;
      classCode: string;
      sessionNumber?: number | null;
      previousDate: Date;
      previousStartTime: string;
      newDate: Date;
      newStartTime: string;
      newEndTime: string;
      reason: string;
    }
  | {
      type: typeof NotificationType.SESSION_CANCELLED;
      classCode: string;
      sessionNumber?: number | null;
      sessionDate: Date;
      reason: string;
      makeupDate?: Date;
      makeupStartTime?: string;
      makeupEndTime?: string;
    }
  | {
      type: typeof NotificationType.SESSION_MAKEUP_ADDED;
      classCode: string;
      makeupDate: Date;
      makeupStartTime: string;
      makeupEndTime: string;
      originalDate?: Date;
    }
  | {
      type: typeof NotificationType.ASSIGNMENT_ASSIGNED;
      assessmentTitle: string;
      classCode: string;
      dueAt: Date;
    }
  | {
      type: typeof NotificationType.ASSIGNMENT_DUE_SOON;
      assessmentTitle: string;
      dueAt: Date;
    }
  | {
      type: typeof NotificationType.SUBMISSION_REOPENED;
      assessmentTitle: string;
      dueAt?: Date | null;
    }
  | {
      type: typeof NotificationType.SUBMISSION_PENDING_GRADING;
      assessmentTitle: string;
      pendingCount: number;
    }
  | {
      type: typeof NotificationType.GRADE_PUBLISHED;
      assessmentTitle: string;
      totalScore: number;
      maxScore: number;
    }
  | {
      type: typeof NotificationType.GRADE_UPDATED;
      assessmentTitle: string;
      totalScore: number;
      maxScore: number;
    };

export function truncateCopy(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function assertSafeInternalLinkPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (
    !trimmed ||
    trimmed.length > 255 ||
    hasControlCharacters(trimmed) ||
    !SAFE_INTERNAL_LINK_PATH_RE.test(trimmed)
  ) {
    throw new BadRequestException('Đường dẫn điều hướng thông báo không hợp lệ');
  }
  return trimmed;
}

function formatScoreValue(score: number): string {
  return Number.isInteger(score) ? String(score) : String(Number(score.toFixed(2)));
}

function formatSessionLabel(sessionNumber?: number | null): string {
  return sessionNumber !== null && sessionNumber !== undefined
    ? `Buổi ${sessionNumber}`
    : 'Buổi học';
}

export function buildNotificationContent(
  input: BuildNotificationContentInput,
): { title: string; body: string } {
  switch (input.type) {
    case NotificationType.NEW_STUDENT_PENDING_CLASS:
      return {
        title: 'Học viên mới chờ xếp lớp',
        body: truncateCopy(`Tài khoản mới chờ xếp lớp: ${input.studentName}`, 500),
      };
    case NotificationType.STUDENT_ENROLLED:
      return {
        title: 'Đã được xếp lớp học',
        body: truncateCopy(`Bạn đã được xếp vào lớp ${input.classCode}.`, 500),
      };
    case NotificationType.STUDENT_TRANSFERRED:
      return {
        title: 'Thông báo chuyển lớp',
        body: truncateCopy(
          `Bạn đã được chuyển từ lớp ${input.sourceClassCode} sang lớp ${input.targetClassCode}.`,
          500,
        ),
      };
    case NotificationType.STUDENT_DROPPED:
      return {
        title: 'Cập nhật trạng thái ghi danh',
        body: truncateCopy(`Bạn đã rời lớp ${input.classCode}.`, 500),
      };
    case NotificationType.TEACHER_ASSIGNED_CLASS:
      return {
        title: input.isReassignment ? 'Nhận bàn giao lớp học' : 'Phân công lớp học mới',
        body: truncateCopy(
          `Bạn được phân công phụ trách lớp ${input.classCode} (${input.courseName}).`,
          500,
        ),
      };
    case NotificationType.SESSION_RESCHEDULED:
      return {
        title: 'Buổi học đã đổi lịch',
        body: truncateCopy(
          `${formatSessionLabel(input.sessionNumber)} lớp ${input.classCode} (${formatDateVn(input.previousDate)} ${input.previousStartTime}) đổi sang ${formatDateVn(input.newDate)} ${input.newStartTime}–${input.newEndTime}. Lý do: ${input.reason}`,
          500,
        ),
      };
    case NotificationType.SESSION_CANCELLED: {
      const makeupNote =
        input.makeupDate && input.makeupStartTime && input.makeupEndTime
          ? ` Học bù ${formatDateVn(input.makeupDate)} ${input.makeupStartTime}–${input.makeupEndTime}.`
          : '';
      return {
        title: 'Buổi học đã bị hủy',
        body: truncateCopy(
          `${formatSessionLabel(input.sessionNumber)} ngày ${formatDateVn(input.sessionDate)} lớp ${input.classCode} bị hủy – ${input.reason}.${makeupNote}`,
          500,
        ),
      };
    }
    case NotificationType.SESSION_MAKEUP_ADDED:
      return {
        title: 'Có buổi học bù mới',
        body: truncateCopy(
          `Lớp ${input.classCode} có buổi học bù vào ${formatDateVn(input.makeupDate)} ${input.makeupStartTime}–${input.makeupEndTime}${input.originalDate ? ` (thay buổi ${formatDateVn(input.originalDate)})` : ''}.`,
          500,
        ),
      };
    case NotificationType.ASSIGNMENT_ASSIGNED:
      return {
        title: 'Bài tập / đề thi mới',
        body: truncateCopy(
          `Bài mới: “${input.assessmentTitle}” lớp ${input.classCode} (hạn ${formatDateTimeVn(input.dueAt)}).`,
          500,
        ),
      };
    case NotificationType.ASSIGNMENT_DUE_SOON:
      return {
        title: 'Bài tập sắp hết hạn',
        body: truncateCopy(
          `Bài “${input.assessmentTitle}” sắp hết hạn lúc ${formatDateTimeVn(input.dueAt)}.`,
          500,
        ),
      };
    case NotificationType.SUBMISSION_REOPENED:
      return {
        title: 'Được mở lại lượt nộp bài',
        body: truncateCopy(
          `Bài “${input.assessmentTitle}” đã được mở lại để bạn tiếp tục chỉnh sửa và nộp lại${input.dueAt ? ` (hạn mới ${formatDateTimeVn(input.dueAt)})` : ''}.`,
          500,
        ),
      };
    case NotificationType.SUBMISSION_PENDING_GRADING:
      return {
        title: 'Có bài nộp chờ chấm',
        body: truncateCopy(
          `${input.pendingCount} bài nộp “${input.assessmentTitle}” đang chờ chấm.`,
          500,
        ),
      };
    case NotificationType.GRADE_PUBLISHED:
      return {
        title: 'Đã công bố điểm bài làm',
        body: truncateCopy(
          `Điểm “${input.assessmentTitle}” đã được công bố: ${formatScoreValue(input.totalScore)}/${formatScoreValue(input.maxScore)}.`,
          500,
        ),
      };
    case NotificationType.GRADE_UPDATED:
      return {
        title: 'Điểm bài làm đã được cập nhật',
        body: truncateCopy(
          `Điểm “${input.assessmentTitle}” đã được cập nhật: ${formatScoreValue(input.totalScore)}/${formatScoreValue(input.maxScore)}.`,
          500,
        ),
      };
  }
}
