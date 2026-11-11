import type {
  ClassStatus,
  CourseLevel,
  Role,
  UserStatus,
} from '@prisma/client';

/** Cleanup #12: never 'MISSING' — only CONFIRMED or NOT_APPLICABLE. */
export type GuardianConsentStatus = 'CONFIRMED' | 'NOT_APPLICABLE';
export type ClassLifecycleStatus =
  | 'UPCOMING'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED';

export interface AvailableClassDto {
  id: string;
  code: string;
  status: ClassStatus;
  startDate: string;
  courseName: string;
  courseLevel: CourseLevel;
  teacherName: string;
  activeStudentsCount: number;
}

export interface PendingStudentDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  guardianEmail: string | null;
  guardianConsentStatus: GuardianConsentStatus;
  createdAt: string;
}

export interface StudentListItemDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  dateOfBirth: string | null;
  guardianEmail: string | null;
  guardianConsentStatus: GuardianConsentStatus;
  assignedClass: string | null;
  enrolledAt: string | null;
}

export interface StudentDetailDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  roles: Role[];
  dateOfBirth: string | null;
  dateOfBirthLocked: boolean;
  hasGuardianConsent: boolean;
  guardianEmail: string | null;
  assignedClass: string | null;
  currentClassId: string | null;
  enrolledAt: string | null;
  classHistory?: string[];
  pastClasses?: Array<Record<string, unknown>>;
  internalNotes: string | null;
  guardianConsent: {
    consented: boolean;
    consentedAt: string;
    guardianEmail: string;
    consentVersion: string;
    formattedDisplay: string;
  } | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface StudentLearningRecordsDto {
  studentId: string;
  records: Array<Record<string, unknown>>;
  message: string;
}

export interface StudentClassHistoryDto {
  studentId: string;
  currentClass: string | null;
  pastClasses: Array<Record<string, unknown>>;
}
