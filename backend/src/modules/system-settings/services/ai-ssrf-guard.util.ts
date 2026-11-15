import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { lookup as dnsLookup } from 'node:dns/promises';
import * as https from 'node:https';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

const MAX_AI_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface SafeResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type DnsLookupAllFn = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

export interface SafeHttpsRequestOptions {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  lookupImpl?: DnsLookupAllFn;
  requestImpl?: typeof https.request;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const octets = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function parseHextetGroup(group: string): number[] | null {
  if (!group) return [];
  const parts = group.split(':');
  const out: number[] = [];
  for (let idx = 0; idx < parts.length; idx += 1) {
    const part = parts[idx]!;
    if (part.includes('.')) {
      if (idx !== parts.length - 1) return null;
      const octets = part.split('.').map((v) => Number.parseInt(v, 10));
      if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
        return null;
      }
      out.push((octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!);
    } else {
      if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
      out.push(Number.parseInt(part, 16));
    }
  }
  return out;
}

function expandIpv6ToHextets(rawIp: string): number[] | null {
  const withoutZone = rawIp.split('%')[0]?.trim().toLowerCase() ?? '';
  if (!withoutZone) return null;

  const doubleColonParts = withoutZone.split('::');
  if (doubleColonParts.length > 2) return null;

  if (doubleColonParts.length === 1) {
    const groups = parseHextetGroup(doubleColonParts[0]!);
    return groups && groups.length === 8 ? groups : null;
  }

  const left = parseHextetGroup(doubleColonParts[0]!);
  const right = parseHextetGroup(doubleColonParts[1]!);
  if (!left || !right) return null;

  const missingZeros = 8 - (left.length + right.length);
  if (missingZeros < 1) return null;

  return [...left, ...Array.from({ length: missingZeros }, (): number => 0), ...right];
}

function hextetsToIpv4(hi: number, lo: number): string {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateOrReservedIpv6(rawIp: string): boolean {
  const h = expandIpv6ToHextets(rawIp);
  if (!h) return true;

  const isAllZeroPrefix6 = h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0;
  // Unspecified :: or Loopback ::1
  if (isAllZeroPrefix6 && h[5] === 0 && h[6] === 0 && (h[7] === 0 || h[7] === 1)) {
    return true;
  }
  // IPv4-mapped ::ffff:0:0/96 or IPv4-compatible ::/96
  if (isAllZeroPrefix6 && (h[5] === 0xffff || h[5] === 0)) {
    return isPrivateOrReservedIpv4(hextetsToIpv4(h[6]!, h[7]!));
  }
  // IPv4-translated ::ffff:0:0:0/96
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0xffff && h[5] === 0) {
    return isPrivateOrReservedIpv4(hextetsToIpv4(h[6]!, h[7]!));
  }
  // NAT64 64:ff9b::/96 & 64:ff9b:1::/48
  if (h[0] === 0x0064 && h[1] === 0xff9b) {
    if (h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0) {
      return isPrivateOrReservedIpv4(hextetsToIpv4(h[6]!, h[7]!));
    }
    if (h[2] === 0x0001) return true;
  }
  // 6to4 2002::/16 (embeds IPv4 in h[1], h[2])
  if (h[0] === 0x2002 && isPrivateOrReservedIpv4(hextetsToIpv4(h[1]!, h[2]!))) {
    return true;
  }
  // Teredo 2001::/32, Documentation 2001:db8::/32, Discard 100::/64
  if (h[0] === 0x2001 && (h[1] === 0 || h[1] === 0x0db8)) return true;
  if (h[0] === 0x0100 && h[1] === 0 && h[2] === 0 && h[3] === 0) return true;

  // Unique local fc00::/7, Link-local fe80::/10, Deprecated site-local fec0::/10, Multicast ff00::/8
  if ((h[0]! & 0xfe00) === 0xfc00) return true;
  if ((h[0]! & 0xffc0) === 0xfe80) return true;
  if ((h[0]! & 0xffc0) === 0xfec0) return true;
  if ((h[0]! & 0xff00) === 0xff00) return true;

  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true;
}

export function assertSafeResolvedIpAddresses(
  records: ReadonlyArray<{ address: string; family?: number }>,
): SafeResolvedAddress[] {
  if (records.length === 0) {
    throw new BadRequestException('Không phân giải được địa chỉ IP hợp lệ cho Base URL AI');
  }

  const validated: SafeResolvedAddress[] = [];
  for (const record of records) {
    const cleanAddress = record.address.trim();
    const version = isIP(cleanAddress);
    if (version !== 4 && version !== 6) {
      throw new BadRequestException('DNS trả về địa chỉ IP không hợp lệ cho Base URL AI');
    }
    if (isPrivateOrReservedIp(cleanAddress)) {
      throw new BadRequestException(
        'Base URL phân giải tới dải IP nội bộ/loopback/metadata bị chặn (SSRF Guard)',
      );
    }
    validated.push({ address: cleanAddress, family: version });
  }

  return validated;
}

function parseAndAssertSafeUrl(rawUrl: string): { parsed: URL; bareHost: string } {
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

  const bareHost = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (
    !bareHost ||
    BLOCKED_HOSTNAMES.has(bareHost) ||
    bareHost.endsWith('.local') ||
    bareHost.endsWith('.internal') ||
    bareHost.endsWith('.localhost') ||
    bareHost.endsWith('.arpa')
  ) {
    throw new BadRequestException('Base URL trỏ tới địa chỉ nội bộ bị chặn vì lý do bảo mật (SSRF)');
  }

  const ipVersion = isIP(bareHost);
  if (ipVersion !== 0 && isPrivateOrReservedIp(bareHost)) {
    throw new BadRequestException('Base URL trỏ tới dải IP nội bộ/riêng tư bị chặn vì lý do bảo mật (SSRF)');
  }

  return { parsed, bareHost };
}

export function validateSafeAiEndpointUrl(rawUrl: string): string {
  const { parsed, bareHost } = parseAndAssertSafeUrl(rawUrl);
  const formattedHost = bareHost.includes(':') ? `[${bareHost}]` : bareHost;
  const portSuffix = parsed.port ? `:${parsed.port}` : '';
  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  return `https://${formattedHost}${portSuffix}${normalizedPath}`;
}

export async function resolveAndValidateAiHost(
  rawUrl: string,
  lookupImpl?: DnsLookupAllFn,
): Promise<{ parsed: URL; bareHost: string; addresses: SafeResolvedAddress[] }> {
  const { parsed, bareHost } = parseAndAssertSafeUrl(rawUrl);
  const ipVersion = isIP(bareHost);
  if (ipVersion === 4 || ipVersion === 6) {
    return {
      parsed,
      bareHost,
      addresses: assertSafeResolvedIpAddresses([{ address: bareHost, family: ipVersion }]),
    };
  }

  const resolver: DnsLookupAllFn =
    lookupImpl ??
    ((hostname, opts) =>
      dnsLookup(hostname, opts) as Promise<Array<{ address: string; family: number }>>);
  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await resolver(bareHost, { all: true, verbatim: true });
  } catch {
    throw new BadGatewayException(
      'Không thể phân giải tên miền dịch vụ AI (lỗi DNS). Vui lòng kiểm tra cấu hình hoặc chấm thủ công.',
    );
  }
  return {
    parsed,
    bareHost,
    addresses: assertSafeResolvedIpAddresses(resolved),
  };
}

export async function sendSafeAiHttpsRequest(
  options: SafeHttpsRequestOptions,
): Promise<{ status: number; bodyText: string }> {
  const timeoutMs = Math.max(1000, options.timeoutMs);
  const deadline = Date.now() + timeoutMs;

  let dnsTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const { parsed, bareHost, addresses } = await Promise.race([
    resolveAndValidateAiHost(options.url, options.lookupImpl),
    new Promise<never>((_resolve, reject) => {
      dnsTimeoutHandle = setTimeout(() => {
        reject(new BadGatewayException('AI Provider phản hồi quá thời gian cho phép (timeout DNS)'));
      }, timeoutMs);
    }),
  ]).finally(() => {
    if (dnsTimeoutHandle) clearTimeout(dnsTimeoutHandle);
  });

  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw new BadGatewayException('AI Provider phản hồi quá thời gian cho phép (timeout)');
  }

  const requestFn = options.requestImpl ?? https.request;
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 443;
  const hostHeader = parsed.port ? `${bareHost}:${parsed.port}` : bareHost;
  const requestPath = `${parsed.pathname}${parsed.search}`;

  return new Promise<{ status: number; bodyText: string }>((resolve, reject) => {
    let settled = false;
    let activeReq: ReturnType<typeof https.request> | null = null;

    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadlineTimer);
      reject(err);
    };

    const deadlineTimer = setTimeout(() => {
      activeReq?.destroy();
      finishError(new BadGatewayException('AI Provider phản hồi quá thời gian cho phép (timeout)'));
    }, remainingMs);

    const pinnedLookup = ((
      _hostname: string,
      lookupOpts: unknown,
      callback: (...args: unknown[]) => void,
    ) => {
      if (lookupOpts && typeof lookupOpts === 'object' && 'all' in lookupOpts && lookupOpts.all) {
        callback(
          null,
          addresses.map((addr) => ({ address: addr.address, family: addr.family })),
        );
        return;
      }
      const primary = addresses[0]!;
      callback(null, primary.address, primary.family);
    }) as NonNullable<https.RequestOptions['lookup']>;

    const req = requestFn(
      {
        protocol: 'https:',
        hostname: bareHost,
        port,
        path: requestPath,
        method: options.method,
        servername: bareHost,
        headers: {
          ...options.headers,
          Host: hostHeader,
        },
        lookup: pinnedLookup,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          req.destroy();
          finishError(
            new BadGatewayException(
              `AI Provider trả về HTTP redirect ${status} không được phép (SSRF Guard)`,
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer | string) => {
          const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
          totalBytes += buf.length;
          if (totalBytes > MAX_AI_RESPONSE_BYTES) {
            req.destroy();
            finishError(new BadGatewayException('Phản hồi từ AI Provider vượt quá dung lượng cho phép'));
            return;
          }
          chunks.push(buf);
        });

        res.on('end', () => {
          if (settled) return;
          settled = true;
          clearTimeout(deadlineTimer);
          resolve({
            status,
            bodyText: Buffer.concat(chunks).toString('utf8'),
          });
        });

        res.on('error', () => {
          finishError(
            new BadGatewayException('Lỗi đọc luồng phản hồi từ AI Provider'),
          );
        });
      },
    );

    activeReq = req;
    req.on('error', (err) => {
      if (err instanceof BadGatewayException || err instanceof BadRequestException) {
        finishError(err);
        return;
      }
      finishError(
        new BadGatewayException(
          'Không thể kết nối tới dịch vụ AI gợi ý chấm điểm. Vui lòng thử lại hoặc chấm thủ công.',
        ),
      );
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}
