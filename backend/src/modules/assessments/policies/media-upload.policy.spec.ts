import { BadRequestException } from '@nestjs/common';
import { assertSafeDocxZip, assertSafeUpload } from './media-upload.policy.js';

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

  it('rejects a docx zip whose uncompressed size is a bomb', () => {
    const name = Buffer.from('a');
    const cd = Buffer.alloc(46 + name.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt32LE(100 * 1024 * 1024, 24);
    cd.writeUInt16LE(name.length, 28);
    name.copy(cd, 46);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(cd.length, 12);
    eocd.writeUInt32LE(4, 16);
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), cd, eocd]);
    expect(() => assertSafeDocxZip(zip)).toThrow(BadRequestException);
  });
});
