import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClassStatus, CourseLevel, Role, UserStatus } from '@prisma/client';
import { CoursesService } from './services/courses.service.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';

interface MockClassRecord {
  id: string;
  courseId: string;
  status: ClassStatus;
}

interface MockCourseRecord {
  id: string;
  code: string;
  name: string;
  level: CourseLevel;
  defaultSessions: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

describe('CoursesService — HSK Course Catalog Management', () => {
  let service: CoursesService;
  let coursesStore: Map<string, MockCourseRecord>;
  let classesStore: MockClassRecord[];
  let auditLogs: Array<Record<string, unknown>>;
  let mockPrisma: Record<string, unknown>;

  const adminActor: AuthenticatedUser = {
    id: 'admin-01',
    email: 'admin@webedu.vn',
    fullName: 'Nguyễn Quản Trị Đào Tạo',
    phone: '0909000003',
    roles: [Role.ADMIN],
    effectiveRole: Role.ADMIN,
    status: UserStatus.ACTIVE,
    tokenVersion: 0,
  };

  beforeEach(() => {
    coursesStore = new Map();
    classesStore = [];
    auditLogs = [];

    const enrichCourse = (course: MockCourseRecord) => {
      const allClasses = classesStore.filter((c) => c.courseId === course.id);
      const activeClasses = allClasses.filter(
        (c) => c.status === ClassStatus.UPCOMING || c.status === ClassStatus.ACTIVE,
      );
      return {
        ...course,
        _count: { classes: allClasses.length },
        classes: activeClasses.map((c) => ({ id: c.id })),
      };
    };

    mockPrisma = {
      course: {
        findMany: vi.fn(
          async ({ where }: { where?: Record<string, unknown> } = {}) => {
            let list = Array.from(coursesStore.values());
            if (where) {
              if (typeof where.isActive === 'boolean') {
                list = list.filter((c) => c.isActive === where.isActive);
              }
              if (typeof where.level === 'string') {
                list = list.filter((c) => c.level === where.level);
              }
              if (Array.isArray(where.OR)) {
                const ors = where.OR as Array<{
                  code?: { contains?: string };
                  name?: { contains?: string };
                }>;
                const needle = (
                  ors[0]?.code?.contains ??
                  ors[0]?.name?.contains ??
                  ''
                ).toLowerCase();
                if (needle) {
                  list = list.filter(
                    (c) =>
                      c.code.toLowerCase().includes(needle) ||
                      c.name.toLowerCase().includes(needle),
                  );
                }
              }
            }
            return list.map(enrichCourse);
          },
        ),
        findUnique: vi.fn(
          async ({
            where,
          }: {
            where: { id?: string; code?: string };
          }) => {
            if (where.id) {
              const found = coursesStore.get(where.id);
              return found ? enrichCourse(found) : null;
            }
            if (where.code) {
              for (const c of coursesStore.values()) {
                if (c.code === where.code) {
                  return enrichCourse(c);
                }
              }
            }
            return null;
          },
        ),
        findFirst: vi.fn(
          async ({
            where,
          }: {
            where: { code?: string; id?: { not?: string } };
          }) => {
            for (const c of coursesStore.values()) {
              if (where.id?.not && c.id === where.id.not) {
                continue;
              }
              if (where.code && c.code === where.code) {
                return enrichCourse(c);
              }
            }
            return null;
          },
        ),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          for (const existing of coursesStore.values()) {
            if (existing.code === data.code) {
              const err = new Error('Unique constraint failed') as Error & {
                code: string;
              };
              err.code = 'P2002';
              throw err;
            }
          }
          const now = new Date('2026-11-10T08:00:00.000Z');
          const created: MockCourseRecord = {
            id: `course-${coursesStore.size + 1}`,
            code: data.code as string,
            name: data.name as string,
            level: data.level as CourseLevel,
            defaultSessions:
              (data.defaultSessions as number | null | undefined) ?? null,
            description:
              (data.description as string | null | undefined) ?? null,
            isActive:
              typeof data.isActive === 'boolean' ? data.isActive : true,
            createdAt: now,
            updatedAt: now,
          };
          coursesStore.set(created.id, created);
          return enrichCourse(created);
        }),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const existing = coursesStore.get(where.id);
            if (!existing) {
              throw new Error('Course not found');
            }
            if (typeof data.code === 'string') {
              for (const other of coursesStore.values()) {
                if (other.id !== existing.id && other.code === data.code) {
                  const err = new Error('Unique constraint failed') as Error & {
                    code: string;
                  };
                  err.code = 'P2002';
                  throw err;
                }
              }
              existing.code = data.code;
            }
            if (typeof data.name === 'string') existing.name = data.name;
            if (typeof data.level === 'string') {
              existing.level = data.level as CourseLevel;
            }
            if ('defaultSessions' in data) {
              existing.defaultSessions =
                (data.defaultSessions as number | null) ?? null;
            }
            if ('description' in data) {
              existing.description =
                (data.description as string | null) ?? null;
            }
            if (typeof data.isActive === 'boolean') {
              existing.isActive = data.isActive;
            }
            existing.updatedAt = new Date('2026-11-10T09:00:00.000Z');
            return enrichCourse(existing);
          },
        ),
      },
      systemAuditLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          auditLogs.push(data);
          return data;
        }),
      },
      $transaction: vi.fn(
        async (cb: (tx: Record<string, unknown>) => Promise<unknown>) =>
          cb(mockPrisma),
      ),
    };

    service = new CoursesService(mockPrisma as unknown as PrismaService);
  });

  it('lists courses sorted deterministically by HSK level order then code ASC and computes active/total class counts', async () => {
    await service.createCourse(adminActor, {
      code: 'GT-CB',
      name: 'Giao Tiếp Cơ Bản',
      level: CourseLevel.BASIC_COMMUNICATION,
      defaultSessions: 20,
    });
    const hsk2 = await service.createCourse(adminActor, {
      code: 'HSK2-B',
      name: 'Tiếng Trung HSK 2 Lớp B',
      level: CourseLevel.HSK2,
      defaultSessions: 24,
    });
    await service.createCourse(adminActor, {
      code: 'HSK2-A',
      name: 'Tiếng Trung HSK 2 Lớp A',
      level: CourseLevel.HSK2,
      defaultSessions: 24,
    });
    await service.createCourse(adminActor, {
      code: 'HSK1',
      name: 'Tiếng Trung HSK 1',
      level: CourseLevel.HSK1,
      defaultSessions: 24,
      isActive: false,
    });

    classesStore.push(
      { id: 'cls-1', courseId: hsk2.id, status: ClassStatus.UPCOMING },
      { id: 'cls-2', courseId: hsk2.id, status: ClassStatus.ACTIVE },
      { id: 'cls-3', courseId: hsk2.id, status: ClassStatus.COMPLETED },
    );

    const allResult = await service.listCourses({});
    expect(allResult.total).toBe(4);
    expect(allResult.items.map((c) => c.code)).toEqual([
      'HSK1',
      'HSK2-A',
      'HSK2-B',
      'GT-CB',
    ]);

    const hsk2Item = allResult.items.find((c) => c.code === 'HSK2-B');
    expect(hsk2Item?.activeClassesCount).toBe(2);
    expect(hsk2Item?.totalClassesCount).toBe(3);
    expect(hsk2Item?.levelLabel).toContain('HSK 2');

    const activeOnlyResult = await service.listCourses({ activeOnly: 'true' });
    expect(activeOnlyResult.total).toBe(3);
    expect(activeOnlyResult.items.every((c) => c.isActive)).toBe(true);

    const searchResult = await service.listCourses({
      search: 'giao tiếp',
      level: CourseLevel.BASIC_COMMUNICATION,
    });
    expect(searchResult.total).toBe(1);
    expect(searchResult.items[0]?.code).toBe('GT-CB');
  });

  it('creates a course with normalized uppercase code, optional defaultSessions, and writes COURSE_CREATED audit log', async () => {
    const created = await service.createCourse(adminActor, {
      code: '  hsk3_tc  ',
      name: '  Tiếng Trung HSK 3 Tiêu Chuẩn  ',
      level: CourseLevel.HSK3,
      defaultSessions: 30,
      description: '  Giáo trình Hán ngữ Chuẩn HSK 3  ',
    });

    expect(created.code).toBe('HSK3_TC');
    expect(created.name).toBe('Tiếng Trung HSK 3 Tiêu Chuẩn');
    expect(created.level).toBe(CourseLevel.HSK3);
    expect(created.defaultSessions).toBe(30);
    expect(created.description).toBe('Giáo trình Hán ngữ Chuẩn HSK 3');
    expect(created.isActive).toBe(true);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]?.action).toBe('COURSE_CREATED');
    expect(auditLogs[0]?.targetType).toBe('Course');
    expect(auditLogs[0]?.targetId).toBe(created.id);
  });

  it('rejects duplicate course code with 409 ConflictException on create and update', async () => {
    await service.createCourse(adminActor, {
      code: 'HSK1',
      name: 'Tiếng Trung HSK 1',
      level: CourseLevel.HSK1,
    });
    const second = await service.createCourse(adminActor, {
      code: 'HSK2',
      name: 'Tiếng Trung HSK 2',
      level: CourseLevel.HSK2,
    });

    await expect(
      service.createCourse(adminActor, {
        code: ' hsk1 ',
        name: 'Bản sao HSK 1',
        level: CourseLevel.HSK1,
      }),
    ).rejects.toThrowError(
      new ConflictException('Mã khóa học đã tồn tại trong hệ thống'),
    );

    await expect(
      service.updateCourse(adminActor, second.id, {
        code: 'hsk1',
      }),
    ).rejects.toThrowError(
      new ConflictException('Mã khóa học đã tồn tại trong hệ thống'),
    );
  });

  it('validates course code format and defaultSessions bounds (1..200)', async () => {
    await expect(
      service.createCourse(adminActor, {
        code: 'A',
        name: 'Khóa học mã quá ngắn',
        level: CourseLevel.HSK1,
      }),
    ).rejects.toThrowError(BadRequestException);

    await expect(
      service.createCourse(adminActor, {
        code: 'HSK 1 INVALID!',
        name: 'Khóa học mã chứa khoảng trắng',
        level: CourseLevel.HSK1,
      }),
    ).rejects.toThrowError(BadRequestException);

    await expect(
      service.createCourse(adminActor, {
        code: 'HSK4',
        name: 'Tiếng Trung HSK 4',
        level: CourseLevel.HSK4,
        defaultSessions: 0,
      }),
    ).rejects.toThrowError(BadRequestException);

    await expect(
      service.createCourse(adminActor, {
        code: 'HSK4',
        name: 'Tiếng Trung HSK 4',
        level: CourseLevel.HSK4,
        defaultSessions: 250,
      }),
    ).rejects.toThrowError(BadRequestException);
  });

  it('updates course details, supports soft-deactivation (isActive=false) while preserving class counts, and writes COURSE_UPDATED audit log', async () => {
    const course = await service.createCourse(adminActor, {
      code: 'HSK4',
      name: 'Tiếng Trung HSK 4',
      level: CourseLevel.HSK4,
      defaultSessions: 36,
      description: 'Mô tả ban đầu',
    });

    classesStore.push({
      id: 'cls-hsk4-1',
      courseId: course.id,
      status: ClassStatus.ACTIVE,
    });

    const updated = await service.updateCourse(adminActor, course.id, {
      name: 'Tiếng Trung HSK 4 Chuyên Sâu',
      defaultSessions: 40,
      description: '',
      isActive: false,
    });

    expect(updated.name).toBe('Tiếng Trung HSK 4 Chuyên Sâu');
    expect(updated.defaultSessions).toBe(40);
    expect(updated.description).toBeNull();
    expect(updated.isActive).toBe(false);
    expect(updated.activeClassesCount).toBe(1);
    expect(updated.totalClassesCount).toBe(1);

    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[1]?.action).toBe('COURSE_UPDATED');
    expect(auditLogs[1]?.targetId).toBe(course.id);

    await expect(
      service.updateCourse(adminActor, 'non-existent-course', {
        name: 'Không tồn tại',
      }),
    ).rejects.toThrowError(new NotFoundException('Không tìm thấy khóa học'));
  });
});
