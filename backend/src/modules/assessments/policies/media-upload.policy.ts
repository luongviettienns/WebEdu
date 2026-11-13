import { BadRequestException } from '@nestjs/common';

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

/** Rejects zip-bombs / ZIP64 before mammoth inflates a .docx. */
export function assertSafeDocxZip(buffer: Buffer): void {
  if (buffer.length < 22) throw new BadRequestException('File Word không hợp lệ');
  let eocd = -1;
  const start = Math.max(0, buffer.length - 22 - 65535);
  for (let i = buffer.length - 22; i >= start; i -= 1) {
    if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new BadRequestException('File Word không hợp lệ');
  const entries = buffer.readUInt16LE(eocd + 10);
  const cdSize = buffer.readUInt32LE(eocd + 12);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new BadRequestException('File Word quá lớn hoặc không hợp lệ');
  }
  if (entries > MAX_ZIP_ENTRIES) throw new BadRequestException('File Word quá lớn hoặc không hợp lệ');
  let pos = cdOffset;
  let total = 0;
  for (let i = 0; i < entries; i += 1) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) {
      throw new BadRequestException('File Word không hợp lệ');
    }
    const uncompressed = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    if (uncompressed === 0xffffffff || uncompressed > MAX_ZIP_ENTRY) {
      throw new BadRequestException('File Word quá lớn hoặc không hợp lệ');
    }
    total += uncompressed;
    if (total > MAX_ZIP_UNCOMPRESSED) throw new BadRequestException('File Word quá lớn hoặc không hợp lệ');
    pos += 46 + nameLen + extraLen + commentLen;
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
