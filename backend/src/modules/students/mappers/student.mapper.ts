import {
  ClassStatus,
  EnrollmentStatus,
  Role,
  type CourseLevel,
  type UserStatus,
} from '@prisma/client';
import {
  formatDateTimeVn,
  formatIsoDateUtc,
} from '../../../common/utils/timezone.util.js';
import type {
  AvailableClassDto,
  GuardianConsentStatus,
  PendingStudentDto,
  StudentDetailDto,
  StudentListItemDto,
} from '../students.types.js';

interface StudentProfileLike {
  dateOfBirth: Date;
  guardianEmail: string | null;
  assignedClass: string | null;
  currentClassId?: string | null;
  internalNotes: string | null;
  enrolledAt: Date | null;
  consent?: {
    consentedAt: Date;
    guardianEmail: string;
    consentVersion: string;
  } | null;
}

interface StudentUserLike {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: UserStatus;
  roles: Role[];
  createdAt?: Date;
  studentProfile?: StudentProfileLike | null;
}

function toConsentStatus(
  profile: StudentProfileLike | null | undefined,
): GuardianConsentStatus {
  return profile?.consent ? 'CONFIRMED' : 'NOT_APPLICABLE';
}

export function toStudentDetailDto(
  user: StudentUserLike,
  actorRoles: Role[],
  actorId?: string,
): StudentDetailDto {
  const profile = user.studentProfile;
  const consent = profile?.consent ?? null;
  const canViewInternalNotes = actorRoles.includes(Role.ADMIN);
  const isSelf = actorId !== undefined && actorId === user.id;
  const canViewClassData =
    isSelf || actorRoles.includes(Role.ADMIN) || actorRoles.includes(Role.TEACHER);

  // Cleanup #13: Strictly omit createdAt / registeredAt ("Đăng ký lúc") on Student Detail DTO
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    roles: user.roles,
    dateOfBirth: profile ? formatIsoDateUtc(profile.dateOfBirth) : null,
    dateOfBirthLocked: Boolean(consent),
    hasGuardianConsent: Boolean(consent),
    guardianEmail: profile?.guardianEmail ?? null,
    assignedClass: canViewClassData ? (profile?.assignedClass ?? null) : null,
    currentClassId: canViewClassData ? (profile?.currentClassId ?? null) : null,
    enrolledAt: canViewClassData && profile?.enrolledAt ? profile.enrolledAt.toISOString() : null,
    internalNotes: canViewInternalNotes ? (profile?.internalNotes ?? null) : null,
    guardianConsent: consent
      ? {
          consented: true,
          consentedAt: consent.consentedAt.toISOString(),
          guardianEmail: consent.guardianEmail,
          consentVersion: consent.consentVersion,
          formattedDisplay: `Đã xác nhận đồng ý của cha mẹ – ${formatDateTimeVn(
            consent.consentedAt,
          )}`,
        }
      : null,
  };
}

export function toStudentListItemDto(
  user: StudentUserLike,
  canViewClassData = true,
): StudentListItemDto {
  const profile = user.studentProfile;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    dateOfBirth: profile ? formatIsoDateUtc(profile.dateOfBirth) : null,
    guardianEmail: profile?.guardianEmail ?? null,
    guardianConsentStatus: toConsentStatus(profile),
    assignedClass: canViewClassData ? (profile?.assignedClass ?? null) : null,
    enrolledAt: canViewClassData && profile?.enrolledAt ? profile.enrolledAt.toISOString() : null,
  };
}

export function toPendingStudentDto(
  user: StudentUserLike & { createdAt: Date },
): PendingStudentDto {
  const profile = user.studentProfile;
  // Cleanup #12: guardianConsentStatus is strictly 'CONFIRMED' | 'NOT_APPLICABLE' (never 'MISSING')
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    dateOfBirth: profile ? formatIsoDateUtc(profile.dateOfBirth) : null,
    guardianEmail: profile?.guardianEmail ?? null,
    guardianConsentStatus: toConsentStatus(profile),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAvailableClassDto(cls: {
  id: string;
  code: string;
  status: ClassStatus;
  startDate: Date;
  course: { name: string; level: CourseLevel };
  teacher: { fullName: string };
  _count: { enrollments: number };
}): AvailableClassDto {
  return {
    id: cls.id,
    code: cls.code,
    status: cls.status,
    startDate: formatIsoDateUtc(cls.startDate),
    courseName: cls.course.name,
    courseLevel: cls.course.level,
    teacherName: cls.teacher.fullName,
    activeStudentsCount: cls._count.enrollments,
  };
}

interface EnrollmentWithClassCourse {
  id: string;
  classId: string;
  status: EnrollmentStatus;
  enrolledDate: Date;
  leftDate: Date | null;
  class: {
    code: string;
    status: ClassStatus;
    course: { code: string; name: string };
  };
}

export function toLearningRecord(
  enrollment: EnrollmentWithClassCourse,
  accessMode: 'FULL' | 'READ_ONLY',
): Record<string, unknown> {
  return {
    enrollmentId: enrollment.id,
    classId: enrollment.classId,
    classCode: enrollment.class.code,
    classStatus: enrollment.class.status,
    courseCode: enrollment.class.course.code,
    courseName: enrollment.class.course.name,
    enrollmentStatus: enrollment.status,
    enrolledDate: formatIsoDateUtc(enrollment.enrolledDate),
    accessMode,
  };
}

export function toPastClassRecord(
  enrollment: EnrollmentWithClassCourse,
): Record<string, unknown> {
  return {
    enrollmentId: enrollment.id,
    classId: enrollment.classId,
    classCode: enrollment.class.code,
    courseName: enrollment.class.course.name,
    enrollmentStatus: enrollment.status,
    enrolledDate: formatIsoDateUtc(enrollment.enrolledDate),
    leftDate: enrollment.leftDate ? formatIsoDateUtc(enrollment.leftDate) : null,
  };
}
