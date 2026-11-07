import {
  fetchApi,
  purgeLegacyWebStorageTokens,
  type RequestOptions,
} from '@/lib/api-client';
import type { Role, UserStatus } from '@/types/user';

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Role[];
  effectiveRole: Role;
  status: UserStatus;
  dateOfBirth?: string;
  assignedClass?: string;
}

export interface RegisterStudentPayload {
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  phone: string;
  email: string;
  password: string;
  confirmPassword?: string;
  guardianEmail?: string;
  guardianConsent?: boolean;
}

export interface RegisterStudentResponse {
  message: string;
  user: AuthUserDto;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  expiresIn: number;
  redirectTo: string;
  user: AuthUserDto;
}

export interface ForgotPasswordResponse {
  message: string;
  cooldownSeconds: number;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword?: string;
}

// ============================================================================
// Authentication APIs (/auth/*)
// ============================================================================

export async function registerStudent(
  payload: RegisterStudentPayload,
): Promise<RegisterStudentResponse> {
  return fetchApi<RegisterStudentResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginWithEmail(
  payload: LoginPayload,
): Promise<LoginResponse> {
  purgeLegacyWebStorageTokens();
  return fetchApi<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(
  options?: RequestOptions,
): Promise<AuthUserDto> {
  return fetchApi<AuthUserDto>('/auth/me', {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function logoutUser(): Promise<{ message: string }> {
  try {
    return await fetchApi<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  } finally {
    purgeLegacyWebStorageTokens();
  }
}

export async function requestPasswordReset(
  email: string,
): Promise<ForgotPasswordResponse> {
  return fetchApi<ForgotPasswordResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<{ message: string }> {
  return fetchApi<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
