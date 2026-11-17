import {
  fetchApi,
  isUnauthorizedError,
  purgeLegacyWebStorageTokens,
  type RequestOptions,
} from '@/lib/api-client';
import type { Role, UserStatus } from '@/types/user';
import { recordSessionActivity } from '@/features/auth/utils/session-activity';

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
  verificationCode?: string;
  guardianEmail?: string;
  guardianConsent?: boolean;
}

export interface SendVerificationCodeResponse {
  message: string;
  expiresInSeconds: number;
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

export async function sendVerificationCode(
  email: string,
  options?: RequestOptions,
): Promise<SendVerificationCodeResponse> {
  return fetchApi<SendVerificationCodeResponse>('/auth/send-verification-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
    ...options,
  });
}

export async function registerStudent(
  payload: RegisterStudentPayload,
): Promise<RegisterStudentResponse> {
  return fetchApi<RegisterStudentResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

let activeLogoutRedirect: string | null = null;

export function setActiveLogoutRedirect(url: string | null): void {
  activeLogoutRedirect = url;
}

export function getActiveLogoutRedirect(): string | null {
  return activeLogoutRedirect;
}

export async function loginWithEmail(
  payload: LoginPayload,
): Promise<LoginResponse> {
  activeLogoutRedirect = null;
  purgeLegacyWebStorageTokens();
  const result = await fetchApi<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  recordSessionActivity(result.user.id);
  return result;
}

export async function getCurrentUser(
  options?: RequestOptions,
): Promise<AuthUserDto> {
  return fetchApi<AuthUserDto>('/auth/me', {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function logoutUser(): Promise<void> {
  try {
    await fetchApi('/auth/logout', {
      method: 'POST',
    });
  } catch (error) {
    if (!isUnauthorizedError(error)) throw error;
  }
  purgeLegacyWebStorageTokens();
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
