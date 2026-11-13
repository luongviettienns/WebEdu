import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { htmlToPlainText, type ExtractedImage } from '../policies/document-import.parser.js';

export type ExtractedDocument = { text: string; images: ExtractedImage[] };

const MAX_PDF_PAGES = 50;
const MAX_IMPORT_IMAGES = 30;
const MAX_IMAGE_B64 = Math.ceil((5 * 1024 * 1024 * 4) / 3);

export async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  try {
    const mammoth = await import('mammoth');
    let imageCount = 0;
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          imageCount += 1;
          if (imageCount > MAX_IMPORT_IMAGES) return { src: '' };
          const b64 = await image.read('base64');
          if (b64.length > MAX_IMAGE_B64) return { src: '' };
          return { src: `data:${image.contentType};base64,${b64}` };
        }),
      },
    );
    return htmlToPlainText(result.value);
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException('File Word bị hỏng hoặc không đọc được');
  }
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      verbosity: 0,
    }).promise;
    if (doc.numPages > MAX_PDF_PAGES) {
      throw new BadRequestException('PDF vượt quá 50 trang');
    }
    const lines: string[] = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      let lastY: number | null = null;
      let line = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = 'transform' in item ? Number(item.transform[5]) : 0;
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          if (line.trim()) lines.push(line.trim());
          line = '';
        }
        line += (line ? ' ' : '') + item.str;
        lastY = y;
      }
      if (line.trim()) lines.push(line.trim());
    }
    return { text: lines.join('\n'), images: [] };
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException('File PDF bị hỏng hoặc không đọc được');
  }
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/** shortcut: local disk (UPLOAD_DIR or cwd/uploads/media), replace with object storage when deploying */
function mediaRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  return configured || join(process.cwd(), 'uploads', 'media');
}

function resolveStoredPath(storageKey: string): string | null {
  if (!storageKey.startsWith('uploads/media/') || storageKey.includes('..')) return null;
  const name = basename(storageKey);
  if (!name || name === '.' || name === '..') return null;
  return join(mediaRoot(), name);
}

export async function persistMediaBytes(bytes: Buffer, mime: string): Promise<string> {
  const id = randomUUID();
  const ext = MIME_EXT[mime] ?? 'bin';
  const name = `${id}.${ext}`;
  await mkdir(mediaRoot(), { recursive: true });
  await writeFile(join(mediaRoot(), name), bytes);
  return `uploads/media/${name}`;
}

export async function readStoredFile(storageKey: string): Promise<Buffer | null> {
  const path = resolveStoredPath(storageKey);
  if (!path) return null;
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

export async function copyStoredFile(storageKey: string): Promise<string | null> {
  const src = resolveStoredPath(storageKey);
  if (!src) return null;
  try {
    const ext = extname(src).replace(/^\./, '') || 'bin';
    const destKey = `uploads/media/${randomUUID()}.${ext}`;
    const dest = resolveStoredPath(destKey);
    if (!dest) return null;
    await mkdir(mediaRoot(), { recursive: true });
    await copyFile(src, dest);
    return destKey;
  } catch {
    return null;
  }
}

export async function unlinkStoredFile(storageKey: string): Promise<void> {
  const path = resolveStoredPath(storageKey);
  if (!path) return;
  try {
    await unlink(path);
  } catch {
    return;
  }
}

export async function cloneAssessmentFiles<T extends { id: string; storageKey: string }>(
  originalStorageKey: string | null,
  assets: T[],
): Promise<{
  copiedKeys: string[];
  originalKey: string | null;
  clonedAssets: Array<{ asset: T; destKey: string }>;
}> {
  const copiedKeys: string[] = [];
  const originalKey = originalStorageKey ? await copyStoredFile(originalStorageKey) : null;
  if (originalKey) copiedKeys.push(originalKey);
  const clonedAssets: Array<{ asset: T; destKey: string }> = [];
  for (const asset of assets) {
    const destKey = await copyStoredFile(asset.storageKey);
    if (!destKey) continue;
    copiedKeys.push(destKey);
    clonedAssets.push({ asset, destKey });
  }
  return { copiedKeys, originalKey, clonedAssets };
}

const EXT_MIME: Record<string, string> = {
  ...Object.fromEntries(Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime])),
  jpeg: 'image/jpeg',
};

export function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}
