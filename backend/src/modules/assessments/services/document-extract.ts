import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { BadRequestException } from '@nestjs/common';
import type { ExtractedImage } from '../policies/document-import.parser.js';

export type ExtractedDocument = { text: string; images: ExtractedImage[] };

const MAX_PDF_PAGES = 50;
const MAX_IMPORT_IMAGES = 30;
const MAX_IMPORT_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_EXTRACT_TIMEOUT_MS = 15_000;

type WorkerExtractResult =
  | { ok: true; text: string; images: Array<{ mime: string; bytes: Uint8Array }> }
  | { ok: false; badRequest?: string; error?: string };

const EXTRACT_WORKER_SCRIPT = `
import { parentPort, workerData } from 'node:worker_threads';

function htmlToPlainText(html) {
  const images = [];
  const withoutImgs = html.replace(
    /<img\\b[^>]*src="data:([^;]+);base64,([^"]+)"[^>]*>/gi,
    (_m, mime, b64) => {
      images.push({ mime, bytes: Buffer.from(b64, 'base64') });
      return '\\n';
    },
  );
  const text = withoutImgs
    .replace(/<(?:br|\\/p|\\/div|\\/li|\\/h[1-6])\\s*\\/?>/gi, '\\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  return { text, images };
}

(async () => {
  if (workerData.kind === 'docx') {
    const mammothMod = await import(workerData.mammothUrl);
    const mammoth = mammothMod.default ?? mammothMod;
    let imageCount = 0;
    let imageBadRequest = null;
    const result = await mammoth.convertToHtml(
      { buffer: Buffer.from(workerData.buffer) },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          if (imageBadRequest) return { src: '' };
          imageCount += 1;
          if (imageCount > workerData.maxImportImages) return { src: '' };
          const rawBuffer = await image.read();
          if (rawBuffer.byteLength > workerData.maxImportImageBytes) {
            imageBadRequest = 'Ảnh nhúng vượt quá 5MB';
            return { src: '' };
          }
          return { src: 'data:' + image.contentType + ';base64,' + rawBuffer.toString('base64') };
        }),
      },
    );
    if (imageBadRequest) {
      parentPort.postMessage({ ok: false, badRequest: imageBadRequest });
      return;
    }
    parentPort.postMessage({ ok: true, ...htmlToPlainText(result.value ?? '') });
    return;
  }

  const pdfjs = await import(workerData.pdfjsUrl);
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(workerData.buffer),
    verbosity: 0,
  }).promise;
  if (doc.numPages > workerData.maxPdfPages) {
    parentPort.postMessage({ ok: false, badRequest: 'PDF vượt quá 50 trang' });
    return;
  }
  const lines = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    let lastY = null;
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
  parentPort.postMessage({ ok: true, text: lines.join('\\n'), images: [] });
})().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  parentPort.postMessage({ ok: false, error: message });
});
`;

function runExtractInWorker(
  kind: 'docx' | 'pdf',
  buffer: Buffer,
  timeoutMs = DEFAULT_EXTRACT_TIMEOUT_MS,
): Promise<ExtractedDocument> {
  if (timeoutMs <= 0) {
    return Promise.reject(new BadRequestException('File quá phức tạp, vượt thời gian xử lý'));
  }

  const worker = new Worker(EXTRACT_WORKER_SCRIPT, {
    eval: true,
    workerData: {
      kind,
      buffer: new Uint8Array(buffer),
      mammothUrl: import.meta.resolve('mammoth'),
      pdfjsUrl: import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'),
      maxPdfPages: MAX_PDF_PAGES,
      maxImportImages: MAX_IMPORT_IMAGES,
      maxImportImageBytes: MAX_IMPORT_IMAGE_BYTES,
    },
  });

  const corruptMsg =
    kind === 'pdf'
      ? 'File PDF bị hỏng hoặc không đọc được'
      : 'File Word bị hỏng hoặc không đọc được';

  return new Promise<ExtractedDocument>((resolve, reject) => {
    let settled = false;
    const stopAndRun = (afterTerminate: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker
        .terminate()
        .catch(() => undefined)
        .then(afterTerminate);
    };

    const timer = setTimeout(() => {
      stopAndRun(() => {
        reject(new BadRequestException('File quá phức tạp, vượt thời gian xử lý'));
      });
    }, timeoutMs);

    worker.on('message', (msg: WorkerExtractResult) => {
      stopAndRun(() => {
        if (!msg.ok) {
          reject(new BadRequestException(msg.badRequest ?? corruptMsg));
          return;
        }
        resolve({
          text: msg.text,
          images: msg.images.map((img) => ({
            mime: img.mime,
            bytes: Buffer.from(img.bytes),
          })),
        });
      });
    });

    worker.on('error', () => {
      stopAndRun(() => reject(new BadRequestException(corruptMsg)));
    });

    worker.on('exit', () => {
      stopAndRun(() => reject(new BadRequestException(corruptMsg)));
    });
  });
}

export async function extractDocx(
  buffer: Buffer,
  timeoutMs = DEFAULT_EXTRACT_TIMEOUT_MS,
): Promise<ExtractedDocument> {
  return runExtractInWorker('docx', buffer, timeoutMs);
}

export async function extractPdf(
  buffer: Buffer,
  timeoutMs = DEFAULT_EXTRACT_TIMEOUT_MS,
): Promise<ExtractedDocument> {
  return runExtractInWorker('pdf', buffer, timeoutMs);
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
