import { BadRequestException } from '@nestjs/common';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_DOC_BYTES = 20 * 1024 * 1024;

function detectMime(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
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
