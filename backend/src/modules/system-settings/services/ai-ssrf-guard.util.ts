import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateOrReservedIpv4(ip: string): boolean {
  const octets = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function extractMappedIpv4FromIpv6(normalizedIp: string): string | null {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(normalizedIp);
  if (dotted?.[1]) return dotted[1];

  const hexPair = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(normalizedIp);
  if (hexPair?.[1] && hexPair[2]) {
    const hi = Number.parseInt(hexPair[1], 16);
    const lo = Number.parseInt(hexPair[2], 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

function isPrivateOrReservedIpv6(rawIp: string): boolean {
  const ip = rawIp.toLowerCase();
  if (ip === '::' || ip === '::1') return true;

  if (ip.startsWith('::ffff:')) {
    const mappedIpv4 = extractMappedIpv4FromIpv6(ip);
    return mappedIpv4 ? isPrivateOrReservedIpv4(mappedIpv4) : true;
  }

  const firstHextetStr = ip.split(':')[0] || '0';
  const firstHextet = Number.parseInt(firstHextetStr, 16);
  if (!Number.isFinite(firstHextet)) return true;

  // Unique local fc00::/7, Link-local fe80::/10, Multicast ff00::/8
  if ((firstHextet & 0xfe00) === 0xfc00) return true;
  if ((firstHextet & 0xffc0) === 0xfe80) return true;
  if ((firstHextet & 0xff00) === 0xff00) return true;
  return false;
}

export function validateSafeAiEndpointUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new BadRequestException('Base URL của nhà cung cấp AI không được để trống');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('Base URL của nhà cung cấp AI không đúng định dạng URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Base URL của nhà cung cấp AI bắt buộc sử dụng giao thức HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new BadRequestException('Base URL của nhà cung cấp AI không được chứa thông tin xác thực trong URL');
  }

  const bareHost = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !bareHost ||
    BLOCKED_HOSTNAMES.has(bareHost) ||
    bareHost.endsWith('.local') ||
    bareHost.endsWith('.internal') ||
    bareHost.endsWith('.localhost')
  ) {
    throw new BadRequestException('Base URL trỏ tới địa chỉ nội bộ bị chặn vì lý do bảo mật (SSRF)');
  }

  const ipVersion = isIP(bareHost);
  if (ipVersion === 4 && isPrivateOrReservedIpv4(bareHost)) {
    throw new BadRequestException('Base URL trỏ tới dải IP nội bộ/riêng tư bị chặn vì lý do bảo mật');
  }
  if (ipVersion === 6 && isPrivateOrReservedIpv6(bareHost)) {
    throw new BadRequestException('Base URL trỏ tới địa chỉ IPv6 nội bộ bị chặn vì lý do bảo mật');
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${normalizedPath}`;
}
