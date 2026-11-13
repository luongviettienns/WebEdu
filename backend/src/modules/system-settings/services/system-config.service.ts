import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { writeAuditLog } from '../../../common/audit/audit-log.util.js';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { validateLogoImageDataUri } from '../../../common/utils/audit-sanitize.util.js';
import { resolvePagination } from '../../../common/utils/pagination.util.js';
import type {
  ListAuditLogsQueryDto,
  UpdateSystemConfigDto,
} from '../dto/system-settings.dto.js';
import {
  DEFAULT_CENTER_NAME,
  SETTING_KEY_CENTER_LOGO_URL,
  SETTING_KEY_CENTER_NAME,
} from '../system-settings.constants.js';

export interface SystemConfigResponseDto {
  centerName: string;
  centerLogoUrl: string | null;
  centerLogoBase64: string | null;
}

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getSystemConfig(): Promise<SystemConfigResponseDto> {
    const rows = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [SETTING_KEY_CENTER_NAME, SETTING_KEY_CENTER_LOGO_URL],
        },
      },
    });

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.key, row.value);
    }

    const centerName = map.get(SETTING_KEY_CENTER_NAME) || DEFAULT_CENTER_NAME;
    const logoValue = map.get(SETTING_KEY_CENTER_LOGO_URL) || null;

    // Cleanup #15: Strictly return ONLY centerName and logo fields (never timezone)
    return {
      centerName,
      centerLogoUrl: logoValue,
      centerLogoBase64: logoValue,
    };
  }

  async updateSystemConfig(
    actor: AuthenticatedUser,
    dto: UpdateSystemConfigDto,
  ): Promise<SystemConfigResponseDto> {
    if ('timezone' in dto && dto.timezone !== undefined) {
      throw new BadRequestException(
        'Trường múi giờ đã bị loại bỏ khỏi cấu hình hệ thống',
      );
    }

    const centerName = (dto.centerName ?? '').trim();
    if (!centerName) {
      throw new BadRequestException('Tên trung tâm không được để trống');
    }

    const rawLogo =
      dto.centerLogoUrl !== undefined
        ? dto.centerLogoUrl
        : dto.centerLogoBase64;
    const trimmedLogo = rawLogo ? rawLogo.trim() : '';

    // Only allow empty/null (clear logo) or valid PNG/JPEG base64 data URI verified by Magic Bytes
    if (trimmedLogo) {
      const validation = validateLogoImageDataUri(trimmedLogo);
      if (!validation.valid) {
        throw new BadRequestException(
          validation.reason ??
            'Logo chỉ chấp nhận định dạng ảnh .png hoặc .jpg hợp lệ',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: SETTING_KEY_CENTER_NAME },
        update: { value: centerName },
        create: {
          key: SETTING_KEY_CENTER_NAME,
          value: centerName,
          description: 'Tên hiển thị trung tâm trên toàn hệ thống',
        },
      });

      if (rawLogo !== undefined) {
        await tx.systemSetting.upsert({
          where: { key: SETTING_KEY_CENTER_LOGO_URL },
          update: { value: trimmedLogo },
          create: {
            key: SETTING_KEY_CENTER_LOGO_URL,
            value: trimmedLogo,
            description: 'Logo trung tâm (PNG/JPG Data URI hoặc URL)',
          },
        });
      }

      await writeAuditLog(tx, actor, {
        action: 'UPDATE_SYSTEM_CONFIG',
        targetType: 'SystemSetting',
        targetId: SETTING_KEY_CENTER_NAME,
        metadata: {
          centerName,
          hasLogo: Boolean(trimmedLogo),
        },
      });
    });

    return this.getSystemConfig();
  }

  async listAuditLogs(query: ListAuditLogsQueryDto): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, skip } = resolvePagination(query, 20);
    const trimmedAction = query?.action?.trim();
    const where: Prisma.SystemAuditLogWhereInput = trimmedAction
      ? { action: trimmedAction }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.systemAuditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.systemAuditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }
}
