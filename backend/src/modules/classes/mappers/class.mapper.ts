import { BadRequestException } from '@nestjs/common';
import {
  ClassStatus,
  EnrollmentStatus,
  type Class,
  type CourseLevel,
  type Prisma,
} from '@prisma/client';
import { formatIsoDateUtc } from '../../../common/utils/timezone.util.js';
import { formatScheduleText } from '../policies/class-schedule.util.js';
import type {
  ClassAccessMode,
  ClassDetailDto,
  ClassEnrollmentItemDto,
  ClassItemDto,
  ClassTeacherHistoryItemDto,
} from '../classes.types.js';

export const CLASS_CODE_REGEX = /^[A-Z0-9_-]{2,20}$/;

export const CLASS_ITEM_INCLUDE = {
  course: {
    select: {
      id: true,
      code: true,
      name: true,
      level: true,
      defaultSessions: true,
    },
  },
  teacher: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  enrollments: {
    where: { status: EnrollmentStatus.ACTIVE },
    select: { id: true },
  },
  _count: {
    select: { enrollments: true },
  },
} satisfies Prisma.ClassInclude;

export interface ClassItemEntity extends Class {
  course: {
    id: string;
    code: string;
    name: string;
    level: CourseLevel;
    defaultSessions: number | null;
  };
  teacher: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
  enrollments?: Array<{ id: string; status?: EnrollmentStatus }>;
  _count?: {
    enrollments?: number;
  };
}

export interface ClassDetailEntity extends ClassItemEntity {
  enrollments: Array<{
    id: string;
    studentId: string;
    status: EnrollmentStatus;
    enrolledDate: Date;
    leftDate: Date | null;
    reason: string | null;
    student: {
      id: string;
      fullName: string;
      email: string;
      phone: string;
    };
  }>;
  teacherHistory: Array<{
    id: string;
    teacherId: string;
    assignedFrom: Date;
    assignedTo: Date | null;
    changedById: string | null;
    reason: string | null;
    createdAt: Date;
    teacher: {
      id: string;
      fullName: string;
      email: string;
    };
    changedBy?: {
      id: string;
      fullName: string;
    } | null;
  }>;
}

export function normalizeAndValidateClassCode(rawCode: string): string {
  const code = rawCode.trim().toUpperCase();
  if (!CLASS_CODE_REGEX.test(code)) {
    throw new BadRequestException(
      'Mã lớp học phải từ 2 đến 20 ký tự và chỉ gồm chữ cái in hoa, chữ số, dấu gạch ngang hoặc gạch dưới',
    );
  }
  return code;
}

export function validateClassTotalSessions(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new BadRequestException(
      'Tổng số buổi học phải là số nguyên từ 1 đến 200 buổi',
    );
  }
  return value;
}

export function toClassItemDto(
  entity: ClassItemEntity,
  scheduleConflictWarning: string | null = null,
): ClassItemDto {
  const enrollments = entity.enrollments ?? [];
  const activeStudentsCount = enrollments.filter(
    (e) => e.status === undefined || e.status === EnrollmentStatus.ACTIVE,
  ).length;
  const totalEnrollmentsCount =
    entity._count?.enrollments ?? enrollments.length;

  return {
    id: entity.id,
    code: entity.code,
    status: entity.status,
    courseId: entity.courseId,
    course: {
      id: entity.course.id,
      code: entity.course.code,
      name: entity.course.name,
      level: entity.course.level,
      defaultSessions: entity.course.defaultSessions ?? null,
    },
    teacherId: entity.teacherId,
    teacher: {
      id: entity.teacher.id,
      fullName: entity.teacher.fullName,
      email: entity.teacher.email,
      phone: entity.teacher.phone,
    },
    scheduleDays: [...entity.scheduleDays],
    scheduleStartTime: entity.scheduleStartTime,
    scheduleEndTime: entity.scheduleEndTime,
    scheduleText: formatScheduleText(
      entity.scheduleDays,
      entity.scheduleStartTime,
      entity.scheduleEndTime,
    ),
    startDate: formatIsoDateUtc(entity.startDate),
    totalSessions: entity.totalSessions,
    expectedEndDate: entity.expectedEndDate
      ? formatIsoDateUtc(entity.expectedEndDate)
      : null,
    actualEndDate: entity.actualEndDate
      ? formatIsoDateUtc(entity.actualEndDate)
      : null,
    closedReason: entity.closedReason ?? null,
    closedAt: entity.closedAt ? entity.closedAt.toISOString() : null,
    notes: entity.notes ?? null,
    activeStudentsCount,
    totalEnrollmentsCount,
    scheduleConflictWarning,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export function toClassDetailDto(
  entity: ClassDetailEntity,
  accessMode?: ClassAccessMode,
  scheduleConflictWarning: string | null = null,
): ClassDetailDto {
  const base = toClassItemDto(entity, scheduleConflictWarning);
  const resolvedAccessMode: ClassAccessMode =
    accessMode ??
    (entity.status === ClassStatus.COMPLETED ||
    entity.status === ClassStatus.ARCHIVED
      ? 'READ_ONLY'
      : 'FULL');

  const enrollments: ClassEnrollmentItemDto[] = entity.enrollments.map((e) => ({
    id: e.id,
    studentId: e.studentId,
    studentFullName: e.student.fullName,
    studentEmail: e.student.email,
    studentPhone: e.student.phone,
    status: e.status,
    enrolledDate: formatIsoDateUtc(e.enrolledDate),
    leftDate: e.leftDate ? formatIsoDateUtc(e.leftDate) : null,
    reason: e.reason ?? null,
  }));

  const teacherHistory: ClassTeacherHistoryItemDto[] =
    entity.teacherHistory.map((h) => ({
      id: h.id,
      teacherId: h.teacherId,
      teacherName: h.teacher.fullName,
      teacherEmail: h.teacher.email,
      assignedFrom: formatIsoDateUtc(h.assignedFrom),
      assignedTo: h.assignedTo ? formatIsoDateUtc(h.assignedTo) : null,
      changedById: h.changedById ?? null,
      changedByName: h.changedBy?.fullName ?? null,
      reason: h.reason ?? null,
      createdAt: h.createdAt.toISOString(),
    }));

  return {
    ...base,
    accessMode: resolvedAccessMode,
    enrollments,
    teacherHistory,
  };
}
