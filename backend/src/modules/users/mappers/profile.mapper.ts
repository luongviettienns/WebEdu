import { ClassStatus, Prisma, Role, UserStatus } from '@prisma/client';
import {
  calculateAgeInVnTimezone,
  formatIsoDateUtc,
} from '../../../common/utils/timezone.util.js';
import { getHighestRole } from '../../../common/auth/role-hierarchy.util.js';

export interface UserProfileDto {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Role[];
  effectiveRole: Role;
  status: UserStatus;
  dateOfBirth?: string;
  assignedClass?: string | null;
  activeClassesCount?: number;
  canSelfChangeEmail?: boolean;
}

export const PROFILE_USER_INCLUDE = {
  studentProfile: true,
  teacherProfile: true,
  _count: {
    select: {
      taughtClasses: {
        where: {
          status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export interface UserProfileSource {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
  studentProfile?: {
    dateOfBirth: Date;
    assignedClass?: string | null;
  } | null;
  teacherProfile?: {
    activeClassesCount?: number;
  } | null;
  _count?: {
    taughtClasses?: number;
  };
}

export function isStudentUnder16(
  user: Pick<UserProfileSource, 'roles' | 'studentProfile'>,
  referenceInstant: Date = new Date(),
): boolean {
  if (!user.roles.includes(Role.STUDENT) || !user.studentProfile?.dateOfBirth) {
    return false;
  }
  const dobIso = formatIsoDateUtc(user.studentProfile.dateOfBirth);
  return calculateAgeInVnTimezone(dobIso, referenceInstant) < 16;
}

export function toUserProfileDto(user: UserProfileSource): UserProfileDto {
  const activeClassesCount = Math.max(
    user.teacherProfile?.activeClassesCount ?? 0,
    user._count?.taughtClasses ?? 0,
  );

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    roles: user.roles,
    effectiveRole: getHighestRole(user.roles),
    status: user.status,
    canSelfChangeEmail: !isStudentUnder16(user),
    ...(user.studentProfile
      ? {
          dateOfBirth: formatIsoDateUtc(user.studentProfile.dateOfBirth),
          assignedClass: user.studentProfile.assignedClass,
        }
      : {}),
    ...(user.roles.includes(Role.TEACHER)
      ? { activeClassesCount }
      : {}),
  };
}
