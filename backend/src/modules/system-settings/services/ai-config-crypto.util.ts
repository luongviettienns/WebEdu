import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const CIPHER_PREFIX = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const DEV_FALLBACK_KEY_MATERIAL = 'webedu-dev-ai-config-encryption-key-2026';

function deriveEncryptionKey(explicitKey?: string): Buffer {
  const material =
    explicitKey?.trim() ||
    process.env.AI_CONFIG_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim();

  if (!material) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'AI_CONFIG_ENCRYPTION_KEY or JWT_SECRET must be configured in production',
      );
    }
    return createHash('sha256').update(DEV_FALLBACK_KEY_MATERIAL).digest();
  }

  return createHash('sha256').update(material).digest();
}

export function encryptAiSecret(plainText: string, explicitKey?: string): string {
  const key = deriveEncryptionKey(explicitKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    CIPHER_PREFIX,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptAiSecret(payload: string, explicitKey?: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== CIPHER_PREFIX) {
    throw new Error('Định dạng khóa AI mã hóa không hợp lệ');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64!, 'base64url');
  const authTag = Buffer.from(tagB64!, 'base64url');
  const encrypted = Buffer.from(dataB64!, 'base64url');
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Độ dài IV hoặc auth tag khóa AI không hợp lệ');
  }

  const key = deriveEncryptionKey(explicitKey);
  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function maskAiApiKey(plainKey: string | null | undefined): string | null {
  const trimmed = plainKey?.trim() ?? '';
  if (!trimmed) return null;
  if (trimmed.length < 8) return '••••••••';
  return `••••••••${trimmed.slice(-4)}`;
}

export function isMaskedApiKeyPlaceholder(candidate: string | undefined | null): boolean {
  if (!candidate) return true;
  const trimmed = candidate.trim();
  return trimmed.length === 0 || trimmed.startsWith('••••');
}
