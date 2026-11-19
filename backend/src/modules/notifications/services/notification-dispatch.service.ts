import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import type {
  DispatchNotificationInput,
  UpsertDedupNotificationInput,
} from '../notifications.types.js';
import {
  assertSafeInternalLinkPath,
  truncateCopy,
} from '../utils/notification-message.util.js';

@Injectable()
export class NotificationDispatchService {
  async resolveActiveAdminRecipientIdsTx(
    tx: Prisma.TransactionClient,
    excludeActorId?: string,
  ): Promise<string[]> {
    const admins = await tx.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        roles: { has: Role.ADMIN },
        ...(excludeActorId ? { id: { not: excludeActorId } } : {}),
      },
      select: { id: true },
    });
    return admins.map((admin) => admin.id);
  }

  async dispatchManyTx(
    tx: Prisma.TransactionClient,
    inputs: ReadonlyArray<DispatchNotificationInput>,
  ): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    const seenDedup = new Set<string>();
    const rows: Prisma.NotificationCreateManyInput[] = [];

    for (const item of inputs) {
      const recipientId = item.recipientId.trim();
      if (!recipientId) continue;

      const dedupKey = item.dedupKey?.trim() || null;
      if (dedupKey) {
        const pairKey = `${recipientId}:${dedupKey}`;
        if (seenDedup.has(pairKey)) continue;
        seenDedup.add(pairKey);
      }

      rows.push({
        recipientId,
        type: item.type,
        title: truncateCopy(item.title, 180),
        body: truncateCopy(item.body, 500),
        linkPath: assertSafeInternalLinkPath(item.linkPath),
        dedupKey,
      });
    }

    if (rows.length === 0) {
      return 0;
    }

    const result = await tx.notification.createMany({
      data: rows,
      skipDuplicates: true,
    });
    return result.count;
  }

  async upsertDedupNotificationTx(
    tx: Prisma.TransactionClient,
    input: UpsertDedupNotificationInput,
  ): Promise<void> {
    const linkPath = assertSafeInternalLinkPath(input.linkPath);
    const title = truncateCopy(input.title, 180);
    const body = truncateCopy(input.body, 500);
    const dedupKey = input.dedupKey.trim();
    const now = new Date();

    await tx.$executeRaw`
      INSERT INTO "notifications" (
        "id", "recipient_id", "type", "title", "body", "link_path",
        "dedup_key", "is_read", "read_at", "created_at"
      )
      VALUES (
        ${randomUUID()},
        ${input.recipientId},
        ${input.type}::"NotificationType",
        ${title},
        ${body},
        ${linkPath},
        ${dedupKey},
        false,
        NULL,
        ${now}
      )
      ON CONFLICT ("recipient_id", "dedup_key") WHERE "dedup_key" IS NOT NULL
      DO UPDATE SET
        "type" = EXCLUDED."type",
        "title" = EXCLUDED."title",
        "body" = EXCLUDED."body",
        "link_path" = EXCLUDED."link_path",
        "is_read" = false,
        "read_at" = NULL,
        "created_at" = EXCLUDED."created_at"
    `;
  }
}
