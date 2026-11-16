import { BadRequestException } from '@nestjs/common';
import { CourseLevel, type Course } from '@prisma/client';
import type { CourseItemDto } from '../courses.types.js';

export const COURSE_CODE_REGEX = /^[A-Z0-9_-]+$/;

export const DEFAULT_MINI_TEST_WEIGHT = 20;
export const DEFAULT_MIDTERM_WEIGHT = 30;
export const DEFAULT_FINAL_WEIGHT = 50;
export const DEFAULT_PASSING_SCORE = 5;

export interface CourseGradingConfig {
  miniTestWeight: number;
  midtermWeight: number;
  finalWeight: number;
  passingScore: number;
}

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  [CourseLevel.HSK1]: 'HSK 1',
  [CourseLevel.HSK2]: 'HSK 2',
  [CourseLevel.HSK3]: 'HSK 3',
  [CourseLevel.HSK4]: 'HSK 4',
  [CourseLevel.BASIC_COMMUNICATION]: 'Giao tiếp cơ bản',
};

export const COURSE_LEVEL_SORT_ORDER: Record<CourseLevel, number> = {
  [CourseLevel.HSK1]: 1,
  [CourseLevel.HSK2]: 2,
  [CourseLevel.HSK3]: 3,
  [CourseLevel.HSK4]: 4,
  [CourseLevel.BASIC_COMMUNICATION]: 5,
};

export interface CourseWithCounts extends Course {
  _count?: {
    classes?: number;
  };
  classes?: Array<{ id: string }>;
}

export function normalizeAndValidateCourseCode(rawCode: string): string {
  const code = rawCode.trim().toUpperCase();
  if (code.length < 2 || code.length > 30 || !COURSE_CODE_REGEX.test(code)) {
    throw new BadRequestException(
      'Mã khóa học phải từ 2 đến 30 ký tự và chỉ gồm chữ cái in hoa, chữ số, dấu gạch ngang hoặc gạch dưới',
    );
  }
  return code;
}

export function normalizeAndValidateCourseName(rawName: string): string {
  const name = rawName.trim();
  if (name.length < 2 || name.length > 150) {
    throw new BadRequestException('Tên khóa học phải từ 2 đến 150 ký tự');
  }
  return name;
}

export function validateCourseDefaultSessions(
  value: number | null | undefined,
): number | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new BadRequestException(
      'Số buổi mặc định phải là số nguyên từ 1 đến 200 buổi',
    );
  }
  return value;
}

export function validateCourseGradingConfig(
  input: CourseGradingConfig,
): CourseGradingConfig {
  const { miniTestWeight, midtermWeight, finalWeight, passingScore } = input;
  const weights = [miniTestWeight, midtermWeight, finalWeight];
  if (weights.some((w) => !Number.isInteger(w) || w < 0 || w > 100)) {
    throw new BadRequestException(
      'Tỷ trọng điểm kiểm tra ngắn, giữa kỳ và cuối khóa phải là số nguyên từ 0 đến 100%',
    );
  }
  if (miniTestWeight + midtermWeight + finalWeight !== 100) {
    throw new BadRequestException(
      'Tổng tỷ trọng điểm (Kiểm tra ngắn + Giữa kỳ + Cuối khóa) phải bằng 100%',
    );
  }
  if (
    typeof passingScore !== 'number' ||
    !Number.isFinite(passingScore) ||
    passingScore < 0 ||
    passingScore > 10
  ) {
    throw new BadRequestException('Điểm đạt phải nằm trong khoảng từ 0 đến 10');
  }
  return {
    miniTestWeight,
    midtermWeight,
    finalWeight,
    passingScore: Math.round(passingScore * 100) / 100,
  };
}

export function toCourseItemDto(course: CourseWithCounts): CourseItemDto {
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    level: course.level,
    levelLabel: COURSE_LEVEL_LABELS[course.level] ?? course.level,
    defaultSessions: course.defaultSessions ?? null,
    miniTestWeight: course.miniTestWeight,
    midtermWeight: course.midtermWeight,
    finalWeight: course.finalWeight,
    passingScore: course.passingScore,
    description: course.description ?? null,
    isActive: course.isActive,
    activeClassesCount: course.classes?.length ?? 0,
    totalClassesCount: course._count?.classes ?? 0,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}
