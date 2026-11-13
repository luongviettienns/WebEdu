import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, AssessmentType, MediaKind, QuestionType, Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { toTeacherAssessmentDto } from '../mappers/assessment.mapper.js';
import { assertCanViewAssessment, listVisibilityWhere } from './assessment-access.policy.js';
import {
  assertSafeDocxZip,
  assertSafeUpload,
  decodeUploadFilename,
} from './media-upload.policy.js';
import {
  assertValidMediaUuids,
  collectPayloadMediaIds,
  collectRequiredMedia,
  remapPayloadMediaIds,
} from './payload-media.util.js';

function makeZipEocd(entriesSizes: number[], countOverride?: number): Buffer {
  const name = Buffer.from('word/document.xml');
  const cds = entriesSizes.map((uncompressed) => {
    const cd = Buffer.alloc(46 + name.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt32LE(10, 20);
    cd.writeUInt32LE(uncompressed, 24);
    cd.writeUInt16LE(name.length, 28);
    name.copy(cd, 46);
    return cd;
  });
  const cdBuf = Buffer.concat(cds);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(countOverride ?? entriesSizes.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(4, 16);
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), cdBuf, eocd]);
}

describe('Phase 5 policies and mapper coverage', () => {
  it('collects, validates, and remaps payload media references cleanly', () => {
    const id1 = '11111111-1111-1111-1111-111111111111';
    const id2 = '22222222-2222-2222-2222-222222222222';
    const copy1 = '33333333-3333-3333-3333-333333333333';
    const copy2 = '44444444-4444-4444-4444-444444444444';

    expect(collectRequiredMedia(QuestionType.LISTENING, { mediaId: id1 })).toEqual([
      { id: id1, kind: MediaKind.AUDIO },
    ]);
    expect(
      collectRequiredMedia(QuestionType.IMAGE_BASED, {
        mediaId: id1,
        options: [{ id: 'a', text: 'A', imageMediaId: id2 }, null],
      }),
    ).toEqual([
      { id: id1, kind: MediaKind.IMAGE },
      { id: id2, kind: MediaKind.IMAGE },
    ]);
    expect(collectPayloadMediaIds({ mediaId: id1, options: [{ imageMediaId: id2 }] })).toEqual([id1, id2]);
    expect(() => assertValidMediaUuids([{ id: id1, kind: MediaKind.AUDIO }])).not.toThrow();
    expect(() => assertValidMediaUuids([{ id: 'bad', kind: MediaKind.AUDIO }])).toThrow(BadRequestException);

    const map = new Map([
      [id1, copy1],
      [id2, copy2],
    ]);
    expect(
      remapPayloadMediaIds({ mediaId: id1, options: [{ id: 'a', imageMediaId: id2 }, { id: 'b' }, 'bad'] }, map),
    ).toEqual({
      mediaId: copy1,
      options: [{ id: 'a', imageMediaId: copy2 }, { id: 'b' }, 'bad'],
    });
    expect(remapPayloadMediaIds(null, map)).toEqual({});
  });

  it('enforces default-deny visibility and throws 404 when row is null', () => {
    expect(() => assertCanViewAssessment({ id: 'a', roles: [Role.ADMIN] }, null)).toThrow(NotFoundException);
    expect(listVisibilityWhere({ id: 'u-1', roles: [Role.STUDENT] })).toEqual({
      id: '00000000-0000-0000-0000-000000000000',
    });
  });

  it('checks audio magic headers, size bounds, zip bombs, and filename decoding', () => {
    expect(() => assertSafeUpload(Buffer.alloc(0), 'empty.png')).toThrow(BadRequestException);
    expect(() => assertSafeUpload(Buffer.alloc(20 * 1024 * 1024 + 1, 0xff), 'big.png')).toThrow(BadRequestException);
    expect(assertSafeUpload(Buffer.from('ID3xxxx'), 'a.mp3')).toEqual({ mime: 'audio/mpeg' });
    expect(assertSafeUpload(Buffer.from([0xff, 0xfb, 0x90, 0x00]), 'b.mp3')).toEqual({ mime: 'audio/mpeg' });
    expect(assertSafeUpload(Buffer.from('RIFF1234WAVE'), 'c.wav')).toEqual({ mime: 'audio/wav' });
    expect(assertSafeUpload(Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70]), 'd.m4a')).toEqual({ mime: 'audio/mp4' });
    expect(() => assertSafeUpload(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]), 'wrong.jpg')).toThrow(BadRequestException);

    expect(() => assertSafeDocxZip(Buffer.from('short'))).toThrow(BadRequestException);
    expect(() => assertSafeDocxZip(makeZipEocd([20], 501))).toThrow(BadRequestException);
    expect(() => assertSafeDocxZip(makeZipEocd([21 * 1024 * 1024]))).toThrow(BadRequestException);
    expect(() => assertSafeDocxZip(makeZipEocd(Array(5).fill(19 * 1024 * 1024)))).toThrow(BadRequestException);
    expect(() => assertSafeDocxZip(makeZipEocd([100], 0xffff))).toThrow(BadRequestException);
    expect(decodeUploadFilename(Buffer.from('Đề HSK1.docx', 'utf8').toString('latin1'))).toBe('Đề HSK1.docx');
    expect(decodeUploadFilename('Đề HSK1.docx')).toBe('Đề HSK1.docx');
  });

  it('maps assessment rows even with missing author or empty questions', () => {
    const dto = toTeacherAssessmentDto({
      id: 'a-1',
      title: 'Test',
      description: null,
      type: AssessmentType.MINI_TEST,
      courseId: 'c-1',
      durationMinutes: null,
      status: AssessmentStatus.DRAFT,
      isLocked: false,
      originalFileName: null,
      createdById: 'u-1',
      updatedAt: new Date('2026-11-13T10:00:00.000Z'),
      createdBy: null,
    });
    expect(dto.createdByName).toBe('');
    expect(dto.totalPoints).toBe(0);
    expect(dto.questionCount).toBe(0);
    expect(dto.questions).toEqual([]);
  });
});
