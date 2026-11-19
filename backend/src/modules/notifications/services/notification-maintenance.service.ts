import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service.js';

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const READ_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const UNREAD_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export interface NotificationCleanupSummary {
  deletedRead: number;
  deletedUnread: number;
}

@Injectable()
export class NotificationMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationMaintenanceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.purgeExpiredNotifications().catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Scheduled notification retention cleanup failed: ${reason}`);
      });
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async purgeExpiredNotifications(
    now: Date = new Date(),
  ): Promise<NotificationCleanupSummary> {
    const readCutoff = new Date(now.getTime() - READ_RETENTION_MS);
    const unreadCutoff = new Date(now.getTime() - UNREAD_RETENTION_MS);

    const deletedRead = await this.prisma.$executeRaw`
      DELETE FROM "notifications"
      WHERE "id" IN (
        SELECT "id" FROM "notifications"
        WHERE "is_read" = true AND "created_at" < ${readCutoff}
        ORDER BY "created_at" ASC
        LIMIT 1000
      )
    `;

    const deletedUnread = await this.prisma.$executeRaw`
      DELETE FROM "notifications"
      WHERE "id" IN (
        SELECT "id" FROM "notifications"
        WHERE "is_read" = false AND "created_at" < ${unreadCutoff}
        ORDER BY "created_at" ASC
        LIMIT 1000
      )
    `;

    return {
      deletedRead: Number(deletedRead),
      deletedUnread: Number(deletedUnread),
    };
  }
}
