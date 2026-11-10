import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassStatus, CourseLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { isPrismaUniqueConstraintError } from '../../../common/utils/prisma-error.util.js';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import type {
  CreateCourseDto,
  ListCoursesQueryDto,
  UpdateCourseDto,
} from '../dto/courses.dto.js';
import type { CourseItemDto, CourseListResponseDto } from '../courses.types.js';
import {
  COURSE_LEVEL_SORT_ORDER,
  normalizeAndValidateCourseCode,
  normalizeAndValidateCourseName,
  toCourseItemDto,
  validateCourseDefaultSessions,
} from '../mappers/course.mapper.js';

const COURSE_INCLUDE = {
  _count: { select: { classes: true } },
  classes: {
    where: { status: { in: [ClassStatus.UPCOMING, ClassStatus.ACTIVE] } },
    select: { id: true },
  },
} satisfies Prisma.CourseInclude;

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async listCourses(query: ListCoursesQueryDto = {}): Promise<CourseListResponseDto> {
    const activeOnly = query.activeOnly === true || query.activeOnly === 'true';
    const search = query.search?.trim();

    const where: Prisma.CourseWhereInput = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const courses = await this.prisma.course.findMany({ where, include: COURSE_INCLUDE });
    const sorted = [...courses].sort((a, b) => {
      const orderDiff =
        (COURSE_LEVEL_SORT_ORDER[a.level] ?? 99) - (COURSE_LEVEL_SORT_ORDER[b.level] ?? 99);
      return orderDiff !== 0 ? orderDiff : a.code.localeCompare(b.code);
    });

    const items = sorted.map(toCourseItemDto);
    return { items, total: items.length };
  }

  async createCourse(actor: AuthenticatedUser, dto: CreateCourseDto): Promise<CourseItemDto> {
    const code = normalizeAndValidateCourseCode(dto.code ?? '');
    const name = normalizeAndValidateCourseName(dto.name ?? '');
    if (!Object.values(CourseLevel).includes(dto.level)) {
      throw new BadRequestException('Cấp độ khóa học không hợp lệ');
    }
    const defaultSessions = validateCourseDefaultSessions(dto.defaultSessions);
    const description = dto.description?.trim() || null;
    const isActive = dto.isActive ?? true;

    const existing = await this.prisma.course.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Mã khóa học đã tồn tại trong hệ thống');
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: { code, name, level: dto.level, defaultSessions, description, isActive },
          include: COURSE_INCLUDE,
        });
        await writeAuditLog(tx, actor, {
          action: 'COURSE_CREATED',
          targetType: 'Course',
          targetId: course.id,
          metadata: {
            code: course.code,
            name: course.name,
            level: course.level,
            defaultSessions: course.defaultSessions,
            isActive: course.isActive,
          },
        });
        return course;
      });
      return toCourseItemDto(created);
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Mã khóa học đã tồn tại trong hệ thống');
      }
      throw err;
    }
  }

  async updateCourse(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateCourseDto,
  ): Promise<CourseItemDto> {
    const existing = await this.prisma.course.findUnique({
      where: { id },
      include: COURSE_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy khóa học');
    }

    const nextCode =
      dto.code !== undefined ? normalizeAndValidateCourseCode(dto.code) : existing.code;
    const nextName =
      dto.name !== undefined ? normalizeAndValidateCourseName(dto.name) : existing.name;
    const nextLevel = dto.level ?? existing.level;
    const nextDefaultSessions =
      dto.defaultSessions !== undefined
        ? validateCourseDefaultSessions(dto.defaultSessions)
        : existing.defaultSessions;
    const nextDescription =
      dto.description !== undefined ? dto.description?.trim() || null : existing.description;
    const nextIsActive = dto.isActive ?? existing.isActive;

    if (nextCode !== existing.code) {
      const duplicate = await this.prisma.course.findFirst({
        where: { code: nextCode, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictException('Mã khóa học đã tồn tại trong hệ thống');
      }
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const course = await tx.course.update({
          where: { id },
          data: {
            code: nextCode,
            name: nextName,
            level: nextLevel,
            defaultSessions: nextDefaultSessions,
            description: nextDescription,
            isActive: nextIsActive,
          },
          include: COURSE_INCLUDE,
        });
        await writeAuditLog(tx, actor, {
          action: 'COURSE_UPDATED',
          targetType: 'Course',
          targetId: course.id,
          metadata: {
            code: course.code,
            name: course.name,
            level: course.level,
            defaultSessions: course.defaultSessions,
            isActive: course.isActive,
          },
        });
        return course;
      });
      return toCourseItemDto(updated);
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException('Mã khóa học đã tồn tại trong hệ thống');
      }
      throw err;
    }
  }
}
