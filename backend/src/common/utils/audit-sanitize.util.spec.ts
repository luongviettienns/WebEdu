import { describe, it, expect } from 'vitest';
import { sanitizeAuditMetadata, validateLogoImageDataUri } from './audit-sanitize.util.js';

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
});
