const SENSITIVE_KEY_PATTERN =
  /(password|token|jwt|secret|cookie|authorization|apikey)/i;

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return sanitizeAuditObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeAuditObject(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeAuditValue(value);
    }
  }
  return sanitized;
}

/**
 * Redacts sensitive fields from audit log metadata before persisting to DB (SEC-10, SEC-F04).
 */
export function sanitizeAuditMetadata(
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  return sanitizeAuditObject(input);
}

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB (FUNC-013)
const MAX_LOGO_BASE64_CHARS = Math.ceil(MAX_LOGO_SIZE_BYTES / 3) * 4 + 4;

/**
 * Validates that a base64 data URI or buffer is a genuine PNG or JPEG image
 * by inspecting Magic Bytes, preventing SVG/HTML XSS polyglots (SEC-09).
 */
export function validateLogoImageDataUri(dataUri: string): {
  valid: boolean;
  mimeType?: 'image/png' | 'image/jpeg';
  reason?: string;
} {
  const match = /^data:(image\/(?:png|jpeg|jpg));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUri.trim(),
  );
  if (!match || !match[2]) {
    return {
      valid: false,
      reason: 'Logo chỉ chấp nhận định dạng ảnh .png hoặc .jpg hợp lệ',
    };
  }

  if (match[2].length > MAX_LOGO_BASE64_CHARS) {
    return {
      valid: false,
      reason: 'Dung lượng file Logo vượt quá giới hạn tối đa 2MB',
    };
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_LOGO_SIZE_BYTES) {
    return {
      valid: false,
      reason: 'Dung lượng file Logo vượt quá giới hạn tối đa 2MB',
    };
  }

  // PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer.byteLength >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  // JPEG Magic Bytes: FF D8 FF
  const isJpeg =
    buffer.byteLength >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  if (isPng) {
    return { valid: true, mimeType: 'image/png' };
  }
  if (isJpeg) {
    return { valid: true, mimeType: 'image/jpeg' };
  }

  return {
    valid: false,
    reason: 'Nội dung file Logo không khớp chữ ký nhị phân PNG/JPG hợp lệ',
  };
}
