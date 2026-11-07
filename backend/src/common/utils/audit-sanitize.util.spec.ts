import { describe, it, expect } from 'vitest';
import { sanitizeAuditMetadata, validateLogoImageDataUri } from './audit-sanitize.util.js';
import {
  assertValidContactFields,
  assertValidInitialPassword,
} from './contact-validation.util.js';

describe('Audit Sanitize & Magic Bytes Logo Validator (SEC-09 & SEC-10)', () => {
  it('redacts sensitive password and token fields recursively from audit metadata', () => {
    const raw = {
      email: 'gv@webedu.vn',
      initialPassword: 'SecretPassword123',
      rawToken: 'hex-reset-token-123',
      debugResetToken: 'debug-token-456',
      jwt: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
      clientSecret: 'my-secret',
      xApiKey: 'sk-live-12345',
      nested: {
        tokenHash: 'abc123hash',
        fullName: 'Nguyễn Văn A',
      },
      batches: [
        {
          id: 'b-1',
          rawToken: 'nested-array-token',
          jwt: 'nested-jwt-value',
          label: 'Safe Label',
        },
        [{ apiKey: 'deep-array-key', count: 2 }],
      ],
    };

    const sanitized = sanitizeAuditMetadata(raw);
    expect(sanitized).toEqual({
      email: 'gv@webedu.vn',
      initialPassword: '[REDACTED]',
      rawToken: '[REDACTED]',
      debugResetToken: '[REDACTED]',
      jwt: '[REDACTED]',
      clientSecret: '[REDACTED]',
      xApiKey: '[REDACTED]',
      nested: {
        tokenHash: '[REDACTED]',
        fullName: 'Nguyễn Văn A',
      },
      batches: [
        {
          id: 'b-1',
          rawToken: '[REDACTED]',
          jwt: '[REDACTED]',
          label: 'Safe Label',
        },
        [{ apiKey: '[REDACTED]', count: 2 }],
      ],
    });
  });

  it('accepts genuine PNG magic bytes and rejects fake SVG disguised as PNG', () => {
    // 1x1 valid PNG header bytes: 89 50 4E 47 0D 0A 1A 0A 00 00 00 0D
    const validPngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const validDataUri = `data:image/png;base64,${validPngBuffer.toString('base64')}`;
    expect(validateLogoImageDataUri(validDataUri)).toEqual({
      valid: true,
      mimeType: 'image/png',
    });

    // Fake SVG disguised with data:image/png;base64,...
    const svgAttack = Buffer.from('<svg onload="alert(1)"></svg>', 'utf-8');
    const maliciousDataUri = `data:image/png;base64,${svgAttack.toString('base64')}`;
    const result = validateLogoImageDataUri(maliciousDataUri);
    expect(result.valid).toBe(false);
  });

  it('detects and blocks image decompression bombs with excessive dimensions (FIX-06)', () => {
    // 24-byte PNG header with 5000x5000 dimensions (25 megapixels)
    const bombPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, // IHDR chunk length 13
      0x49, 0x48, 0x44, 0x52, // 'IHDR'
      0x00, 0x00, 0x13, 0x88, // Width: 5000
      0x00, 0x00, 0x13, 0x88, // Height: 5000
      0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    const bombUri = `data:image/png;base64,${bombPng.toString('base64')}`;
    const bombResult = validateLogoImageDataUri(bombUri);
    expect(bombResult.valid).toBe(false);
    expect(bombResult.reason).toContain('Kích thước ảnh Logo vượt quá giới hạn tối đa');

    // Valid 200x200 PNG header
    const validDimsPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0xc8, // Width: 200
      0x00, 0x00, 0x00, 0xc8, // Height: 200
      0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    const validUri = `data:image/png;base64,${validDimsPng.toString('base64')}`;
    const validResult = validateLogoImageDataUri(validUri);
    expect(validResult.valid).toBe(true);
    expect(validResult.mimeType).toBe('image/png');
  });

  it('handles non-object inputs and Date instances in sanitizeAuditMetadata and validates JPEG SOF0 dimensions', () => {
    expect(sanitizeAuditMetadata(null)).toBeUndefined();
    expect(sanitizeAuditMetadata(undefined)).toBeUndefined();
    expect(sanitizeAuditMetadata([] as unknown as Record<string, unknown>)).toBeUndefined();

    const now = new Date('2026-11-07T00:00:00.000Z');
    expect(sanitizeAuditMetadata({ occurredAt: now, password: 'secret' })).toEqual({
      occurredAt: now,
      password: '[REDACTED]',
    });

    // Valid JPEG with APP0 segment + SOF0 (0xFFC0) 100x100 dimensions
    const validJpeg = Buffer.from([
      0xff, 0xd8, // SOI
      0xff, 0xd0, // RST0 marker
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 segment length 4
      0xff, 0xc0, 0x00, 0x11, 0x08, // SOF0 marker, length 17, precision 8
      0x00, 0x64, // Height: 100
      0x00, 0x64, // Width: 100
      0x03, 0x01, 0x22, 0x00,
    ]);
    const validJpegRes = validateLogoImageDataUri(
      `data:image/jpeg;base64,${validJpeg.toString('base64')}`,
    );
    expect(validJpegRes).toEqual({ valid: true, mimeType: 'image/jpeg' });

    // Oversized JPEG 2000x2000 bomb
    const bombJpeg = Buffer.from([
      0xff, 0xd8,
      0xff, 0xc0, 0x00, 0x11, 0x08,
      0x07, 0xd0, // Height: 2000
      0x07, 0xd0, // Width: 2000
      0x03, 0x01, 0x22, 0x00,
    ]);
    const bombJpegRes = validateLogoImageDataUri(
      `data:image/jpeg;base64,${bombJpeg.toString('base64')}`,
    );
    expect(bombJpegRes.valid).toBe(false);
    expect(bombJpegRes.reason).toContain('Kích thước ảnh Logo vượt quá giới hạn');
  });

  it('validates contact fields and initial password bounds in contact-validation.util', () => {
    expect(() =>
      assertValidContactFields({
        fullName: 'Nguyễn Văn A',
        email: 'valid@example.com',
        phone: '0901234567',
      }),
    ).not.toThrow();

    expect(() => assertValidContactFields({ fullName: '   ' })).toThrowError(
      'Họ và tên không được để trống',
    );
    expect(() => assertValidContactFields({ email: 'bad-email' })).toThrowError(
      'Email không hợp lệ',
    );
    expect(() => assertValidContactFields({ phone: '123' })).toThrowError(
      'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0',
    );

    expect(() => assertValidInitialPassword('ValidPass123')).not.toThrow();
    expect(() => assertValidInitialPassword('short')).toThrowError(
      'Mật khẩu phải có ít nhất 8 ký tự',
    );
    expect(() => assertValidInitialPassword('X'.repeat(73))).toThrowError(
      'Mật khẩu không được vượt quá 72 ký tự',
    );
  });
});
