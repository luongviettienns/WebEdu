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

export const API_BASE_URL = '/api/v1';

const LEGACY_ACCESS_TOKEN_STORAGE_KEY = 'webedu_access_token';
const EXAM_DRAFT_STORAGE_PREFIX = 'webedu_exam_draft_';

function purgeStorageKeys(storage: Storage, includeExamDrafts: boolean): void {
  storage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  if (!includeExamDrafts) {
    return;
  }
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i);
    if (key && key.startsWith(EXAM_DRAFT_STORAGE_PREFIX)) {
      storage.removeItem(key);
    }
  }
}

function purgeLegacyAccessTokensOnly(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    purgeStorageKeys(window.localStorage, false);
    purgeStorageKeys(window.sessionStorage, false);
  } catch {
    // Bỏ qua nếu trình duyệt hạn chế quyền truy cập Storage
  }
}

/**
 * Xóa triệt để mọi khóa token cũ và bản nháp bài thi cục bộ khi đăng nhập/đăng xuất/hết phiên.
 * Phiên xác thực trình duyệt sử dụng duy nhất Cookie HttpOnly (SameSite=Lax),
 * không bao giờ lưu trữ JWT trong localStorage, sessionStorage hay biến JS.
 */
export function purgeLegacyWebStorageTokens(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    purgeStorageKeys(window.localStorage, true);
    purgeStorageKeys(window.sessionStorage, true);
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


}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  purgeLegacyAccessTokensOnly();
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

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    return undefined as unknown as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    return rawText as unknown as T;
  }
}

export const requestJson = fetchApi;

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
