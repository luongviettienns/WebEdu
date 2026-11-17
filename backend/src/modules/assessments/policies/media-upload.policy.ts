import { BadRequestException } from '@nestjs/common';
import { promisify } from 'node:util';
import { inflateRaw } from 'node:zlib';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_DOC_BYTES = 20 * 1024 * 1024;

/** Detects safe raster image MIME types (PNG/JPEG) strictly from magic bytes. */
export function detectSafeImageMime(buffer: Buffer): 'image/png' | 'image/jpeg' | null {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

function detectMime(buffer: Buffer): string | null {
  const safeImage = detectSafeImageMime(buffer);
  if (safeImage) return safeImage;
  if (buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return 'audio/mpeg';
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return 'audio/wav';
  }
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'audio/mp4';
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  return null;
}

/** Validates magic bytes + size, never trusting client MIME. Returns detected MIME or throws 400. */
export function assertSafeUpload(buffer: Buffer, filename: string): { mime: string } {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mime = detectMime(buffer);
  if (!mime) throw new BadRequestException('Định dạng file không được hỗ trợ');

  const imageExts: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  const audioExts: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4' };
  const docExts: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pdf: 'application/pdf',
  };

  const expected = imageExts[ext] ?? audioExts[ext] ?? docExts[ext];
  if (!expected || expected !== mime) {
    throw new BadRequestException('Nội dung file không khớp với định dạng cho phép');
  }
  const limit = imageExts[ext] ? MAX_IMAGE_BYTES : audioExts[ext] ? MAX_AUDIO_BYTES : MAX_DOC_BYTES;
  if (buffer.byteLength === 0 || buffer.byteLength > limit) {
    throw new BadRequestException('Dung lượng file vượt quá giới hạn cho phép');
  }
  return { mime };
}

const MAX_ZIP_UNCOMPRESSED = 80 * 1024 * 1024;
const MAX_ZIP_ENTRY = 20 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 500;
const inflateEntry = promisify(inflateRaw);

export async function assertSafeDocxZip(buffer: Buffer): Promise<void> {
  const invalid = () => new BadRequestException('File Word quá lớn hoặc không hợp lệ');
  // Match the extractor's last-signature lookup before trusting any directory.
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd > buffer.length - 22 ||
      eocd + 22 + buffer.readUInt16LE(eocd + 20) !== buffer.length) throw invalid();
  const entries = buffer.readUInt16LE(eocd + 10);
  const cdSize = buffer.readUInt32LE(eocd + 12);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (buffer.readUInt32LE(eocd + 4) !== 0 || buffer.readUInt16LE(eocd + 8) !== entries ||
      entries === 0 || entries > MAX_ZIP_ENTRIES || cdOffset + cdSize !== eocd) throw invalid();
  const files: Array<{ offset: number; start: number; end: number; method: number; size: number }> = [];
  let pos = cdOffset;
  let total = 0;
  for (let i = 0; i < entries; i += 1) {
    if (pos + 46 > eocd || buffer.readUInt32LE(pos) !== 0x02014b50) throw invalid();
    const flags = buffer.readUInt16LE(pos + 8);
    const method = buffer.readUInt16LE(pos + 10);
    const compressed = buffer.readUInt32LE(pos + 20);
    const uncompressed = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const offset = buffer.readUInt32LE(pos + 42);
    if ((flags & 1) || (method !== 0 && method !== 8) || buffer.readUInt16LE(pos + 34) !== 0 ||
        uncompressed > MAX_ZIP_ENTRY || offset + 30 > cdOffset ||
        buffer.readUInt32LE(offset) !== 0x04034b50 ||
        buffer.readUInt16LE(offset + 8) !== method) throw invalid();
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const end = start + compressed;
    if (end > cdOffset) throw invalid();
    files.push({ offset, start, end, method, size: uncompressed });
    total += uncompressed;
    if (total > MAX_ZIP_UNCOMPRESSED) throw invalid();
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (pos !== eocd) throw invalid();
  let previousEnd = 0;
  for (const file of files.sort((a, b) => a.offset - b.offset)) {
    if (file.offset < previousEnd) throw invalid();
    previousEnd = file.end;
    const bytes = buffer.subarray(file.start, file.end);
    const actualSize = file.method === 0
      ? bytes.length
      : (await inflateEntry(bytes, { maxOutputLength: Math.max(1, file.size) })
          .catch(() => { throw invalid(); })).length;
    if (actualSize !== file.size) throw invalid();
  }
}

/** shortcut: multer latin1 originalname; drop when busboy utf8 is default */
export function decodeUploadFilename(name: string): string {
  for (let i = 0; i < name.length; i += 1) {
    if (name.charCodeAt(i) > 0xff) return name;
  }
  try {
    return Buffer.from(name, 'latin1').toString('utf8') || name;
  } catch {
    return name;
  }
}
