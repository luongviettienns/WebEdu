/**
 * RFC 7807 / RFC 9457 Problem Details for HTTP APIs
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp?: string;
  invalidParams?: string[];
  [key: string]: unknown;
}

// Backward-compatible alias
export type ApiErrorResponse = ProblemDetails;

export interface HealthCheckResponse {
  status: string;
  service: string;
  database?: string;
  timezone: string;
  timestamp: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const LEGACY_ACCESS_TOKEN_STORAGE_KEY = 'webedu_access_token';

/**
 * Xóa triệt để mọi khóa token cũ nếu từng tồn tại trong Web Storage.
 * Phiên xác thực trình duyệt sử dụng duy nhất Cookie HttpOnly (SameSite=Lax),
 * không bao giờ lưu trữ JWT trong localStorage, sessionStorage hay biến JS.
 */
export function purgeLegacyWebStorageTokens(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Bỏ qua nếu trình duyệt hạn chế quyền truy cập Storage
  }
}

function normalizeHeaders(headersInit?: HeadersInit): Record<string, string> {
  if (!headersInit) {
    return {};
  }
  if (headersInit instanceof Headers) {
    const normalized: Record<string, string> = {};
    headersInit.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }
  if (Array.isArray(headersInit)) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of headersInit) {
      normalized[key] = value;
    }
    return normalized;
  }
  return { ...headersInit };
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails,
  ) {
    const errorDetails = problem.invalidParams?.length
      ? `${problem.detail}: ${problem.invalidParams.join(', ')}`
      : problem.detail || problem.title || `API Request Failed with status ${status}`;
    super(errorDetails);
    this.name = 'ApiClientError';
  }

  get statusCode(): number {
    return this.status;
  }

  get errorResponse(): ProblemDetails {
    return this.problem;
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  purgeLegacyWebStorageTokens();
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...defaultHeaders,
      ...normalizeHeaders(options.headers),
    },
  });

  if (!response.ok) {
    let problem: ProblemDetails;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = {
        type: 'about:blank',
        title: response.statusText || 'HTTP Error',
        status: response.status,
        detail: 'Lỗi phản hồi không xác định từ máy chủ',
        instance: endpoint,
        timestamp: new Date().toISOString(),
      };
    }
    throw new ApiClientError(response.status, problem);
  }

  return response.json() as Promise<T>;
}

export const requestJson = fetchApi;

export async function getSystemHealth(): Promise<HealthCheckResponse> {
  return fetchApi<HealthCheckResponse>('/health');
}

/**
 * Tùy chọn chung cho các lời gọi API đọc dữ liệu: cho phép hủy request
 * (AbortController) để tránh phản hồi cũ ghi đè phản hồi mới.
 */
export interface RequestOptions {
  signal?: AbortSignal;
}

/**
 * Ghép query string từ tham số; bỏ qua giá trị rỗng/falsy (undefined, '', 0).
 * Trả về chuỗi rỗng hoặc chuỗi bắt đầu bằng '?'.
 */
export function buildQueryString(
  params: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export function extractErrorMessage(
  error: unknown,
  fallback = 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.',
): string {
  if (error instanceof ApiClientError) {
    return error.problem.detail || error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 403;
}
