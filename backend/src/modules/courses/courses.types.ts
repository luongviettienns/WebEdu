import type { CourseLevel } from '@prisma/client';

export interface CourseItemDto {
  id: string;
  code: string;
  name: string;
  level: CourseLevel;
  levelLabel: string;
  defaultSessions: number | null;
  description: string | null;
  isActive: boolean;
  activeClassesCount: number;
  totalClassesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseListResponseDto {
  items: CourseItemDto[];
  total: number;
}
