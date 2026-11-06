import {
  ApiClientError,
  fetchApi,
  setStoredAccessToken,
} from './api-client';

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPERADMIN';

export type UserStatus = 'PENDING_CLASS' | 'ACTIVE' | 'INACTIVE';

export type GuardianConsentStatus = 'CONFIRMED' | 'NOT_APPLICABLE';

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học viên',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  PENDING_CLASS: 'Chờ xếp lớp',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Vô hiệu hóa',
};

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
  accessToken: string;
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

export interface UpdateProfileResponse extends UserProfileDto {
  accessToken?: string;
  expiresIn?: number;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface ChangePasswordResponse {
  message: string;
  accessToken?: string;
  expiresIn?: number;
}

export interface TeacherItemDto {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  isAdmin: boolean;
  activeClassesCount: number;
  notes?: string | null;
  createdAt?: string;
}

export interface TeacherListResponse {
  items: TeacherItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTeacherPayload {
  fullName: string;
  phone: string;
  email: string;
  initialPassword: string;
  notes?: string;
}

export interface UpdateTeacherPayload {
  fullName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  status?: UserStatus;
}

export interface GuardianConsentInfoDto {
  consented: boolean;
  guardianEmail: string;
  consentedAt: string;
  consentVersion?: string;
  formattedDisplay?: string;
}

export interface StudentItemDto {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  dateOfBirthLocked?: boolean;
  age?: number;
  phone: string;
  email: string;
  status: UserStatus;
  assignedClass?: string | null;
  guardianEmail?: string | null;
  hasGuardianConsent?: boolean;
  guardianConsent?: GuardianConsentInfoDto | null;
  internalNotes?: string | null;
  enrolledAt?: string | null;
  classHistory?: string[];
}

export interface StudentListResponse {
  items: StudentItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface PendingStudentDto {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  phone: string;
  email: string;
  registeredAt?: string;
  createdAt?: string;
  guardianConsentStatus: GuardianConsentStatus;
  guardianEmail?: string | null;
}

export interface PendingEnrollmentResponse {
  items: PendingStudentDto[];
  totalPending: number;
}

export interface UpdateStudentPayload {
  fullName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  status?: UserStatus;
  internalNotes?: string;
}

export interface AssignInitialClassPayload {
  classNameOrId: string;
  enrolledAt?: string;
}

export interface SystemUserDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  effectiveRole?: Role;
  status: UserStatus;
  createdAt?: string;
}

export interface CreateSystemUserPayload {
  fullName: string;
  email: string;
  phone: string;
  initialPassword: string;
  roles: Role[];
  status?: UserStatus;
}

export interface UpdateSystemUserRolesPayload {
  roles: Role[];
  status?: UserStatus;
}

export interface SystemConfigDto {
  centerName: string;
  centerLogoUrl?: string | null;
  centerLogoBase64?: string | null;
  updatedAt?: string;
}

export interface AuditLogItemDto {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actor?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  actingRole?: Role | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  items: AuditLogItemDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Tính tuổi chính xác theo giờ Việt Nam (Asia/Ho_Chi_Minh).
 * Xử lý chuẩn cả năm nhuận 29/02 và biên 00:00-06:59 GMT+7.
 */
export function calculateAgeInVnTimezone(
  dateOfBirthIso?: string | null,
  referenceInstant?: Date,
): number | null {
  const trimmed = (dateOfBirthIso ?? '').trim();
  if (!trimmed) {
    return null;
  }

  const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
  const parts = datePart ? datePart.split('-') : [];
  if (parts.length !== 3) {
    return null;
  }

  const dobYear = Number(parts[0]);
  const dobMonth = Number(parts[1]);
  const dobDay = Number(parts[2]);

  if (
    !Number.isInteger(dobYear) ||
    !Number.isInteger(dobMonth) ||
    !Number.isInteger(dobDay) ||
    dobYear < 1900 ||
    dobMonth < 1 ||
    dobMonth > 12 ||
    dobDay < 1 ||
    dobDay > 31
  ) {
    return null;
  }

  const refInstant = referenceInstant ?? new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const vnDateString = formatter.format(refInstant);
  const [refYearStr, refMonthStr, refDayStr] = vnDateString.split('-');
  const refYear = Number(refYearStr);
  const refMonth = Number(refMonthStr);
  const refDay = Number(refDayStr);

  let age = refYear - dobYear;
  if (refMonth < dobMonth || (refMonth === dobMonth && refDay < dobDay)) {
    age -= 1;
  }
  return age;
}

/**
 * Định dạng chuỗi ngày YYYY-MM-DD hoặc ISO sang dd/mm/yyyy
 */
export function formatDateDdMmYyyy(isoDateOrTimestamp?: string | null): string {
  if (!isoDateOrTimestamp) {
    return '—';
  }
  const trimmed = isoDateOrTimestamp.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const dateObj = new Date(trimmed);
  if (Number.isNaN(dateObj.getTime())) {
    return trimmed;
  }
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);
}

/**
 * Định dạng ISO timestamp sang dd/mm/yyyy HH:mm (hoặc dd/mm/yyyy HH:mm:ss)
 */
export function formatDateTimeVn(
  isoTimestamp?: string | null,
  includeSeconds = false,
): string {
  if (!isoTimestamp) {
    return '—';
  }
  const dateObj = new Date(isoTimestamp);
  if (Number.isNaN(dateObj.getTime())) {
    return isoTimestamp;
  }
  const datePart = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj);

  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(dateObj);

  return `${datePart} ${timePart}`;
}

/**
 * Lấy đường dẫn mặc định theo vai trò cao nhất
 */
export function getDefaultRouteForRole(role: Role): string {
  switch (role) {
    case 'SUPERADMIN':
      return '/superadmin/settings';
    case 'ADMIN':
      return '/admin/students';
    case 'TEACHER':
      return '/teacher/classes';
    case 'STUDENT':
    default:
      return '/student/overview';
  }
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

export function userHasAnyRole(
  user: Pick<AuthUserDto, 'roles' | 'effectiveRole'> | null | undefined,
  allowedRoles: readonly Role[],
): boolean {
  if (!user) {
    return false;
  }
  const assignedRoles =
    Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : [user.effectiveRole];
  return allowedRoles.some(
    (role) => assignedRoles.includes(role) || user.effectiveRole === role,
  );
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 403;
}

export const SYSTEM_CONFIG_UPDATED_EVENT = 'webedu:system-config-updated';

/**
 * Chỉ chấp nhận chuỗi Data URI ảnh PNG/JPEG hợp lệ hoặc đường dẫn nội bộ tương đối,
 * loại bỏ URL bên ngoài http(s):// và vector SVG.
 */
export function sanitizeBrandLogoSrc(logo?: string | null): string | null {
  if (!logo) {
    return null;
  }
  const trimmed = logo.trim();
  if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  return null;
}

// ============================================================================
// A. Authentication APIs (/auth/*)
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
  const response = await fetchApi<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (response.accessToken) {
    setStoredAccessToken(response.accessToken);
  }
  return response;
}

export async function getCurrentUser(): Promise<AuthUserDto> {
  return fetchApi<AuthUserDto>('/auth/me', {
    method: 'GET',
  });
}

export async function logoutUser(): Promise<{ message: string }> {
  try {
    return await fetchApi<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  } finally {
    setStoredAccessToken(null);
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

// ============================================================================
// B. Profile APIs (/profile/*)
// ============================================================================

export async function getMyProfile(): Promise<UserProfileDto> {
  return fetchApi<UserProfileDto>('/profile/me', {
    method: 'GET',
  });
}

export async function updateMyProfile(
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResponse> {
  const response = await fetchApi<UpdateProfileResponse>('/profile/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (response.accessToken) {
    setStoredAccessToken(response.accessToken);
  }
  return response;
}

export async function changeMyPassword(
  payload: ChangePasswordPayload,
): Promise<ChangePasswordResponse> {
  const response = await fetchApi<ChangePasswordResponse>(
    '/profile/change-password',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  if (response.accessToken) {
    setStoredAccessToken(response.accessToken);
  }
  return response;
}

// ============================================================================
// C. Teachers Management APIs (/teachers/*)
// ============================================================================

export async function listTeachers(params?: {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<TeacherListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return fetchApi<TeacherListResponse>(`/teachers${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

export async function createTeacher(
  payload: CreateTeacherPayload,
): Promise<TeacherItemDto> {
  return fetchApi<TeacherItemDto>('/teachers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTeacher(
  id: string,
  payload: UpdateTeacherPayload,
): Promise<TeacherItemDto> {
  return fetchApi<TeacherItemDto>(`/teachers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// ============================================================================
// D. Students & Pending Enrollment APIs (/students/*)
// ============================================================================

export async function listStudents(params?: {
  search?: string;
  status?: string;
  className?: string;
  page?: number;
  limit?: number;
}): Promise<StudentListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.className) query.set('className', params.className);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return fetchApi<StudentListResponse>(`/students${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

export async function listPendingEnrollmentStudents(): Promise<PendingEnrollmentResponse> {
  return fetchApi<PendingEnrollmentResponse>('/students/pending-enrollment', {
    method: 'GET',
  });
}

export async function getStudentDetail(id: string): Promise<StudentItemDto> {
  return fetchApi<StudentItemDto>(`/students/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function updateStudent(
  id: string,
  payload: UpdateStudentPayload,
): Promise<StudentItemDto> {
  return fetchApi<StudentItemDto>(`/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function assignStudentInitialClass(
  id: string,
  payload: AssignInitialClassPayload,
): Promise<StudentItemDto> {
  return fetchApi<StudentItemDto>(
    `/students/${encodeURIComponent(id)}/assign-initial-class`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

// ============================================================================
// E. Superadmin System Settings APIs (/system-settings/*)
// ============================================================================

export async function listSystemUsers(): Promise<SystemUserDto[]> {
  const res = await fetchApi<{ items?: SystemUserDto[] } | SystemUserDto[]>(
    '/system-settings/users',
    {
      method: 'GET',
    },
  );
  if (Array.isArray(res)) {
    return res;
  }
  return res.items ?? [];
}

export async function createSystemUser(
  payload: CreateSystemUserPayload,
): Promise<SystemUserDto> {
  return fetchApi<SystemUserDto>('/system-settings/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSystemUserRoles(
  id: string,
  payload: UpdateSystemUserRolesPayload,
): Promise<SystemUserDto> {
  return fetchApi<SystemUserDto>(
    `/system-settings/users/${encodeURIComponent(id)}/roles`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

export async function getSystemConfig(): Promise<SystemConfigDto> {
  return fetchApi<SystemConfigDto>('/system-settings/config', {
    method: 'GET',
  });
}

export async function updateSystemConfig(
  payload: SystemConfigDto,
): Promise<SystemConfigDto> {
  const updated = await fetchApi<SystemConfigDto>('/system-settings/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<SystemConfigDto>(SYSTEM_CONFIG_UPDATED_EVENT, {
        detail: updated,
      }),
    );
  }
  return updated;
}

export async function listAuditLogs(params?: {
  page?: number;
  limit?: number;
}): Promise<AuditLogListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return fetchApi<AuditLogListResponse>(
    `/system-settings/audit-logs${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
    },
  );
}
