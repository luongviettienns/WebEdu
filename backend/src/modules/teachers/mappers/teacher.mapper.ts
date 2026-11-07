import { Role, type UserStatus } from '@prisma/client';

export interface TeacherItemDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  isAdmin: boolean;
  status: UserStatus;
  notes: string | null;
  activeClassesCount: number;
  createdAt: string;
}

interface TeacherUserLike {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
  createdAt: Date;
  teacherProfile?: { notes: string | null; activeClassesCount: number } | null;
  _count?: { taughtClasses?: number };
}

function resolveActiveClassesCount(user: TeacherUserLike): number {
  const profileCount = user.teacherProfile?.activeClassesCount ?? 0;
  const dbClassCount = user._count?.taughtClasses ?? 0;
  return Math.max(profileCount, dbClassCount);
}

export function toTeacherItemDto(user: TeacherUserLike): TeacherItemDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    roles: user.roles,
    isAdmin: user.roles.includes(Role.ADMIN),
    status: user.status,
    notes: user.teacherProfile?.notes ?? null,
    activeClassesCount: resolveActiveClassesCount(user),
    createdAt: user.createdAt.toISOString(),
  };
}
