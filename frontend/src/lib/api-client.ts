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

  // Backward compatibility getter
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
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
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

export async function getSystemHealth(): Promise<HealthCheckResponse> {
  return fetchApi<HealthCheckResponse>('/health');
}
