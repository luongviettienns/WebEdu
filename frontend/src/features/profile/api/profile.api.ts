import { fetchApi, type RequestOptions } from '@/lib/api-client';
import type { AuthUserDto } from '@/features/auth/api/auth.api';

export interface UserProfileDto extends AuthUserDto {
  activeClassesCount?: number;
  guardianEmail?: string | null;
  enrolledAt?: string | null;
  createdAt?: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  email?: string;
  currentPassword?: string;
}

export type UpdateProfileResponse = UserProfileDto;

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface ChangePasswordResponse {
  message: string;
}

// ============================================================================
// Profile APIs (/profile/*)
// ============================================================================

export async function getMyProfile(
  options?: RequestOptions,
): Promise<UserProfileDto> {
  return fetchApi<UserProfileDto>('/profile/me', {
    method: 'GET',
    signal: options?.signal,
  });
}

export async function updateMyProfile(
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResponse> {
  return fetchApi<UpdateProfileResponse>('/profile/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function changeMyPassword(
  payload: ChangePasswordPayload,
): Promise<ChangePasswordResponse> {
  return fetchApi<ChangePasswordResponse>('/profile/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
