import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service.js';
import { collectPayloadMediaIds } from '../policies/payload-media.util.js';
import { mimeFromFilename, readStoredFile } from './document-extract.js';

@Injectable()
export class AssessmentMediaAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verifies a media asset belongs to the target assessment without reading file bytes from disk. */
  async verifyAssetForAssessment(
    assessmentId: string,
    mediaId: string,
  ): Promise<{ id: string; storageKey: string; mime: string }> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!asset) throw new NotFoundException('Không tìm thấy file đính kèm');
    if (asset.assessmentId && asset.assessmentId !== assessmentId) {
      throw new NotFoundException('Không tìm thấy file đính kèm');
    }
    if (!asset.assessmentId) {
      const questions = await this.prisma.question.findMany({
        where: { assessmentId },
        select: { payload: true },
      });
      if (!questions.some((q) => collectPayloadMediaIds(q.payload).includes(mediaId))) {
        throw new NotFoundException('Không tìm thấy file đính kèm');
      }
    }
    return { id: asset.id, storageKey: asset.storageKey, mime: asset.mime };
  }

  /** Streams a media asset after verifying it belongs to the target assessment (directly or via legacy question payload). */
  async streamVerifiedAsset(assessmentId: string, mediaId: string): Promise<StreamableFile> {
    const asset = await this.verifyAssetForAssessment(assessmentId, mediaId);
    return this.streamStoredFile(
      asset.storageKey,
      asset.storageKey.split('/').pop() ?? 'media',
      false,
      asset.mime,
    );
  }

  /** Reads a stored media or original document key from disk and wraps it in a StreamableFile with safe headers. */
  async streamStoredFile(
    storageKey: string,
    filename: string,
    asDownload: boolean,
    mimeOverride?: string,
  ): Promise<StreamableFile> {
    const bytes = await readStoredFile(storageKey);
    if (!bytes) throw new NotFoundException('Không tìm thấy file đính kèm');
    const safe = filename.replace(/[\r\n"]/g, '_');
    const ascii = safe.replace(/[^\x20-\x7E]/g, '_');
    const kind = asDownload ? 'attachment' : 'inline';
    return new StreamableFile(bytes, {
      type: mimeOverride || mimeFromFilename(filename),
      disposition: `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
    });
  }
}
