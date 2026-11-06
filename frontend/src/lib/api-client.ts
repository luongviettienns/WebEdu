export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

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
    public readonly statusCode: number,
    public readonly errorResponse: ApiErrorResponse,
  ) {
    super(
      Array.isArray(errorResponse.message)
        ? errorResponse.message.join(', ')
        : errorResponse.message || 'API Request Failed',
    );
    this.name = 'ApiClientError';
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
    let errorData: ApiErrorResponse;
    try {
      errorData = (await response.json()) as ApiErrorResponse;
    } catch {
      errorData = {
        statusCode: response.status,
        error: response.statusText,
        message: 'Lỗi phản hồi không xác định từ máy chủ',
        timestamp: new Date().toISOString(),
        path: endpoint,
      };
    }
    throw new ApiClientError(response.status, errorData);
  }

  return response.json() as Promise<T>;
}

export async function getSystemHealth(): Promise<HealthCheckResponse> {
  return fetchApi<HealthCheckResponse>('/health');
}
