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
 * Redacts sensitive fields from audit log metadata before persisting to DB.
 */
export function sanitizeAuditMetadata(
  input: Record<string, unknown> | undefined | null,
): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  return sanitizeAuditObject(input);
}

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_LOGO_BASE64_CHARS = Math.ceil(MAX_LOGO_SIZE_BYTES / 3) * 4 + 4;
export const MAX_LOGO_WIDTH = 800; // max 800px width
export const MAX_LOGO_HEIGHT = 800; // max 800px height
export const MAX_LOGO_PIXELS = 640_000; // max 800x800 = 640k pixels

function extractJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2; // after 0xFF 0xD8
  while (offset < buffer.byteLength - 8) {
    if (buffer[offset] !== 0xff) {
      break;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd9) break; // End of image
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && offset + 8 < buffer.byteLength) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) break;
    offset += 2 + segmentLength;
  }
  return null;
}

/**
 * Validates that a base64 data URI or buffer is a genuine PNG or JPEG image
 * by inspecting Magic Bytes, preventing SVG/HTML XSS polyglots and
 * checking image dimensions against decompression bombs.
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
    if (buffer.byteLength >= 24) {
      const isIhdr =
        buffer[12] === 0x49 &&
        buffer[13] === 0x48 &&
        buffer[14] === 0x44 &&
        buffer[15] === 0x52;
      if (isIhdr) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (
          width > MAX_LOGO_WIDTH ||
          height > MAX_LOGO_HEIGHT ||
          width * height > MAX_LOGO_PIXELS
        ) {
          return {
            valid: false,
            reason: `Kích thước ảnh Logo vượt quá giới hạn tối đa cho phép (tối đa ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT} pixel)`,
          };
        }
      }
    }
    return { valid: true, mimeType: 'image/png' };
  }

  if (isJpeg) {
    const dimensions = extractJpegDimensions(buffer);
    if (dimensions) {
      if (
        dimensions.width > MAX_LOGO_WIDTH ||
        dimensions.height > MAX_LOGO_HEIGHT ||
        dimensions.width * dimensions.height > MAX_LOGO_PIXELS
      ) {
        return {
          valid: false,
          reason: `Kích thước ảnh Logo vượt quá giới hạn tối đa cho phép (tối đa ${MAX_LOGO_WIDTH}x${MAX_LOGO_HEIGHT} pixel)`,
        };
      }
    }
    return { valid: true, mimeType: 'image/jpeg' };
  }

  return {
    valid: false,
    reason: 'Nội dung file Logo không khớp chữ ký nhị phân PNG/JPG hợp lệ',
  };
}
