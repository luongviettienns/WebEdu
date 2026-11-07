const PNG_BASE64_MAGIC = 'iVBORw0KGgo';
const JPEG_BASE64_MAGIC = '/9j/';

/**
 * Chỉ chấp nhận chuỗi Data URI ảnh PNG/JPEG hợp lệ hoặc đường dẫn nội bộ tương đối,
 * loại bỏ URL bên ngoài http(s):// và vector SVG.
 */
export function sanitizeBrandLogoSrc(logo?: string | null): string | null {
  if (!logo) {
    return null;
  }
  const trimmed = logo.trim();
  if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  return null;
}

export function normalizeAndVerifyLogoDataUrl(
  rawValue?: string | null,
): string | null {
  if (!rawValue) {
    return null;
  }
  const normalized = rawValue
    .trim()
    .replace(/^data:image\/jpg;base64,/i, 'data:image/jpeg;base64,');

  const pngPrefix = 'data:image/png;base64,';
  const jpegPrefix = 'data:image/jpeg;base64,';

  if (normalized.startsWith(pngPrefix)) {
    const payload = normalized.slice(pngPrefix.length);
    return payload.startsWith(PNG_BASE64_MAGIC) ? normalized : null;
  }

  if (normalized.startsWith(jpegPrefix)) {
    const payload = normalized.slice(jpegPrefix.length);
    return payload.startsWith(JPEG_BASE64_MAGIC) ? normalized : null;
  }

  return null;
}
