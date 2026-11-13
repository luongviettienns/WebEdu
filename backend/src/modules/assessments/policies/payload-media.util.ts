import { BadRequestException } from '@nestjs/common';
import { MediaKind, QuestionType } from '@prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequiredMediaRef {
  id: string;
  kind: MediaKind;
}

/**
 * Extracts all media asset IDs referenced by a question payload along with the
 * expected MediaKind (`AUDIO` for LISTENING stem, `IMAGE` everywhere else).
 */
export function collectRequiredMedia(type: QuestionType, payload: unknown): RequiredMediaRef[] {
  const p = (payload ?? {}) as Record<string, unknown>;
  const byId = new Map<string, MediaKind>();
  if (typeof p.mediaId === 'string' && p.mediaId.trim()) {
    byId.set(p.mediaId.trim(), type === QuestionType.LISTENING ? MediaKind.AUDIO : MediaKind.IMAGE);
  }
  const options = Array.isArray(p.options) ? p.options : [];
  for (const option of options) {
    if (typeof option === 'object' && option !== null) {
      const imgId = (option as { imageMediaId?: unknown }).imageMediaId;
      if (typeof imgId === 'string' && imgId.trim()) {
        byId.set(imgId.trim(), MediaKind.IMAGE);
      }
    }
  }
  return [...byId.entries()].map(([id, kind]) => ({ id, kind }));
}

export function collectPayloadMediaIds(payload: unknown): string[] {
  return collectRequiredMedia(QuestionType.IMAGE_BASED, payload).map((m) => m.id);
}

export function assertValidMediaUuids(refs: RequiredMediaRef[]): void {
  for (const ref of refs) {
    if (!UUID_RE.test(ref.id)) {
      throw new BadRequestException('mediaId không hợp lệ');
    }
  }
}

/**
 * Rewrites referenced `mediaId` and `options[].imageMediaId` fields when
 * duplicating an assessment so cloned questions point to cloned assets.
 */
export function remapPayloadMediaIds(payload: unknown, idMap: ReadonlyMap<string, string>): Record<string, unknown> {
  const src = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const next: Record<string, unknown> = { ...src };
  if (typeof src.mediaId === 'string') {
    const mapped = idMap.get(src.mediaId.trim());
    if (mapped) next.mediaId = mapped;
  }
  if (Array.isArray(src.options)) {
    next.options = src.options.map((opt) => {
      if (typeof opt !== 'object' || opt === null) return opt;
      const obj = opt as Record<string, unknown>;
      if (typeof obj.imageMediaId !== 'string') return obj;
      const mapped = idMap.get(obj.imageMediaId.trim());
      return mapped ? { ...obj, imageMediaId: mapped } : obj;
    });
  }
  return next;
}
