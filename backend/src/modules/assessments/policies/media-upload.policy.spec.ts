import { BadRequestException } from '@nestjs/common';
import { assertSafeUpload } from './media-upload.policy.js';

function buf(bytes: number[], size: number): Buffer {
  const b = Buffer.alloc(size);
  bytes.forEach((v, i) => {
    b[i] = v;
  });
  return b;
}

describe('media-upload.policy (Task 5.1 TDD)', () => {
  it('rejects PDF bytes disguised as mp3', () => {
    const fakeMp3 = buf([0x25, 0x50, 0x44, 0x46], 1024);
    expect(() => assertSafeUpload(fakeMp3, 'audio.mp3')).toThrow(BadRequestException);
  });

  it('rejects oversized PNG image', () => {
    const bigPng = buf([0x89, 0x50, 0x4e, 0x47], 5 * 1024 * 1024 + 1);
    expect(() => assertSafeUpload(bigPng, 'pic.png')).toThrow(BadRequestException);
  });

  it('accepts real MP3 within limit', () => {
    const mp3 = buf([0x49, 0x44, 0x33, 0x04], 1024);
    expect(assertSafeUpload(mp3, 'listen.mp3')).toEqual({ mime: 'audio/mpeg' });
  });
});
