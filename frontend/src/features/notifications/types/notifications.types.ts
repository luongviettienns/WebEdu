export type NotificationType =
  | 'NEW_STUDENT_PENDING_CLASS'
  | 'STUDENT_ENROLLED'
  | 'STUDENT_TRANSFERRED'
  | 'STUDENT_DROPPED'
  | 'TEACHER_ASSIGNED_CLASS'
  | 'SESSION_RESCHEDULED'
  | 'SESSION_CANCELLED'
  | 'SESSION_MAKEUP_ADDED'
  | 'ASSIGNMENT_ASSIGNED'
  | 'ASSIGNMENT_DUE_SOON'
  | 'SUBMISSION_REOPENED'
  | 'SUBMISSION_PENDING_GRADING'
  | 'GRADE_PUBLISHED'
  | 'GRADE_UPDATED';

export type NotificationFilterStatus = 'all' | 'unread';

export interface NotificationItemDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  linkPath: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponseDto {
  items: NotificationItemDto[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UnreadCountResponseDto {
  unreadCount: number;
}

export interface MarkReadResponseDto {
  id: string;
  isRead: boolean;
  readAt: string;
}

export interface MarkAllReadResponseDto {
  markedCount: number;
  unreadCount: number;
}
