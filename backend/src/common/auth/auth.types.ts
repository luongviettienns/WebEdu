import { Role, UserStatus } from '@prisma/client';

export const CONSENT_VERSION = 'v1.0';
export const CONSENT_TEXT_V1_0 =
  'Tôi xác nhận là cha mẹ/người giám hộ hợp pháp của học viên dưới 16 tuổi và đồng ý cho con đăng ký học tập, lưu trữ dữ liệu học vụ tại Trung tâm TD Hán Ngữ theo quy định bảo vệ dữ liệu cá nhân.';

export interface JwtPayload {
  sub: string;
  email: string;
  tokenVersion: number;
  rememberMe?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Role[];
  effectiveRole: Role;
  status: UserStatus;
  tokenVersion: number;
  rememberMe?: boolean;
}

export interface AuthUserDto {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Role[];
  effectiveRole: Role;
  status: UserStatus;
  dateOfBirth?: string;
}
