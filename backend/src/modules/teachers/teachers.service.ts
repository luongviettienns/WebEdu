import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { sanitizeAuditMetadata } from '../../common/utils/audit-sanitize.util.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import type {
  CreateTeacherDto,
  ListTeachersQueryDto,
  UpdateTeacherDto,
} from './dto/teachers.dto.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^0\d{9}$/;

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

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  private toTeacherItemDto(user: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    roles: Role[];
    status: UserStatus;
    createdAt: Date;
    teacherProfile?: { notes: string | null; activeClassesCount: number } | null;
  }): TeacherItemDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles: user.roles,
      isAdmin: user.roles.includes(Role.ADMIN),
      status: user.status,
      notes: user.teacherProfile?.notes ?? null,
      activeClassesCount: user.teacherProfile?.activeClassesCount ?? 0,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async listTeachers(query: ListTeachersQueryDto): Promise<{
    items: TeacherItemDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      roles: { has: Role.TEACHER },
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { teacherProfile: true },
        orderBy: { fullName: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => this.toTeacherItemDto(u)),
      total,
      page,
      limit,
    };
  }

  async createTeacher(
    actor: AuthenticatedUser,
    dto: CreateTeacherDto,
  ): Promise<TeacherItemDto> {
    const fullName = (dto.fullName ?? '').trim();
    if (!fullName) {
      throw new BadRequestException('Họ và tên không được để trống');
    }

    const email = (dto.email ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const phone = (dto.phone ?? '').trim();
    if (!PHONE_REGEX.test(phone)) {
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
    }

    const initialPassword = dto.initialPassword ?? '';
    if (initialPassword.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (initialPassword.length > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 ký tự');
    }

    const duplicate = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }],
      },
    });
    if (duplicate) {
      throw new ConflictException('Email/Số điện thoại đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          email,
          phone,
          passwordHash,
          roles: [Role.TEACHER],
          status: UserStatus.ACTIVE,
        },
      });

      const teacherProfile = await tx.teacherProfile.create({
        data: {
          userId: user.id,
          notes: dto.notes?.trim() || null,
          activeClassesCount: 0,
        },
      });

      await tx.systemAuditLog.create({
        data: {
          actorId: actor.id,
          actingRole: actor.effectiveRole,
          action: 'CREATE_TEACHER',
          targetType: 'User',
          targetId: user.id,
          metadata: sanitizeAuditMetadata({
            fullName,
            email,
            phone,
            initialPassword,
          }) as Prisma.InputJsonValue,
        },
      });

      return { ...user, teacherProfile };
    });

    return this.toTeacherItemDto(created);
  }

  async updateTeacher(
    actor: AuthenticatedUser,
    teacherId: string,
    dto: UpdateTeacherDto,
  ): Promise<TeacherItemDto> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: teacherId },
      include: { teacherProfile: true },
    });

    if (!targetUser || !targetUser.roles.includes(Role.TEACHER)) {
      throw new NotFoundException('Không tìm thấy giáo viên');
    }

    if (
      (targetUser.roles.includes(Role.SUPERADMIN) ||
        targetUser.roles.includes(Role.ADMIN)) &&
      !actor.roles.includes(Role.SUPERADMIN)
    ) {
      throw new ForbiddenException(
        'Admin không có quyền chỉnh sửa hoặc khóa tài khoản Quản trị viên / Quản trị tối cao',
      );
    }

    if (
      dto.status !== undefined &&
      dto.status !== UserStatus.ACTIVE &&
      dto.status !== UserStatus.INACTIVE
    ) {
      throw new BadRequestException(
        'Trạng thái giáo viên chỉ chấp nhận ACTIVE hoặc INACTIVE',
      );
    }

    const nextFullName =
      dto.fullName !== undefined ? dto.fullName.trim() : targetUser.fullName;
    if (!nextFullName) {
      throw new BadRequestException('Họ và tên không được để trống');
    }

    const nextEmail =
      dto.email !== undefined
        ? dto.email.trim().toLowerCase()
        : targetUser.email;
    if (!EMAIL_REGEX.test(nextEmail)) {
      throw new BadRequestException('Email không hợp lệ');
    }

    const nextPhone =
      dto.phone !== undefined ? dto.phone.trim() : targetUser.phone;
    if (!PHONE_REGEX.test(nextPhone)) {
      throw new BadRequestException(
        'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
      );
    }

    if (nextEmail !== targetUser.email || nextPhone !== targetUser.phone) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          id: { not: teacherId },
          OR: [{ email: nextEmail }, { phone: nextPhone }],
        },
      });
      if (duplicate) {
        throw new ConflictException('Email/Số điện thoại đã được sử dụng');
      }
    }

    const nextStatus = dto.status ?? targetUser.status;
    const isLeavingActiveSuperadmin =
      targetUser.roles.includes(Role.SUPERADMIN) &&
      nextStatus !== UserStatus.ACTIVE;

    if (isLeavingActiveSuperadmin && actor.id === targetUser.id) {
      throw new BadRequestException(
        'Superadmin không thể tự vô hiệu hóa tài khoản của chính mình',
      );
    }

    const emailChanged = nextEmail !== targetUser.email;
    const isDeactivating =
      nextStatus === UserStatus.INACTIVE &&
      targetUser.status !== UserStatus.INACTIVE;
    const shouldRevokeTokens = isDeactivating || emailChanged;

    if (nextStatus === UserStatus.INACTIVE) {
      const activeClassesCount =
        targetUser.teacherProfile?.activeClassesCount ?? 0;
      if (activeClassesCount > 0) {
        throw new ConflictException(
          `Giáo viên đang phụ trách ${activeClassesCount} lớp. Vui lòng phân công giáo viên khác`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isLeavingActiveSuperadmin) {
        const activeSuperadmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "users" WHERE 'SUPERADMIN' = ANY("roles") AND "status" = 'ACTIVE' FOR UPDATE
        `;
        const otherActiveCount = activeSuperadmins.filter(
          (row) => row.id !== targetUser.id,
        ).length;
        if (otherActiveCount < 1) {
          throw new BadRequestException(
            'Hệ thống bắt buộc duy trì tối thiểu 1 Superadmin đang hoạt động',
          );
        }
      }

      const updatedUser = await tx.user.update({
        where: { id: teacherId },
        data: {
          fullName: nextFullName,
          email: nextEmail,
          phone: nextPhone,
          status: nextStatus,
          ...(shouldRevokeTokens ? { tokenVersion: { increment: 1 } } : {}),
        },
        include: { teacherProfile: true },
      });

      let profile = updatedUser.teacherProfile ?? targetUser.teacherProfile;
      if (dto.notes !== undefined) {
        profile = await tx.teacherProfile.upsert({
          where: { userId: teacherId },
          update: { notes: dto.notes.trim() || null },
          create: {
            userId: teacherId,
            notes: dto.notes.trim() || null,
            activeClassesCount: 0,
          },
        });
      }

      await tx.systemAuditLog.create({
        data: {
          actorId: actor.id,
          actingRole: actor.effectiveRole,
          action: 'UPDATE_TEACHER',
          targetType: 'User',
          targetId: teacherId,
          metadata: sanitizeAuditMetadata({
            previousStatus: targetUser.status,
            newStatus: nextStatus,
            fullName: nextFullName,
            email: nextEmail,
            phone: nextPhone,
          }) as Prisma.InputJsonValue,
        },
      });

      return { ...updatedUser, teacherProfile: profile };
    });

    return this.toTeacherItemDto(updated);
  }
}
