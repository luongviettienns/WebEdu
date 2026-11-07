import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { sanitizeAuditMetadata } from '../utils/audit-sanitize.util.js';

export interface AuditLogEntry {
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
}

/**
 * Writes a SystemAuditLog row inside the caller's transaction so the audit
 * record commits atomically with the primary change. Metadata is always
 * passed through `sanitizeAuditMetadata` (passwords/tokens -> [REDACTED]).
 */
export async function writeAuditLog(
  tx: Prisma.TransactionClient,
  actor: Pick<AuthenticatedUser, 'id' | 'effectiveRole'>,
  entry: AuditLogEntry,
): Promise<void> {
  await tx.systemAuditLog.create({
    data: {
      actorId: actor.id,
      actingRole: actor.effectiveRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: sanitizeAuditMetadata(
        entry.metadata,
      ) as Prisma.InputJsonValue,
    },
  });
}
