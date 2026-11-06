'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import { PortalGuardView } from '@/components/auth/AccessDeniedState';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { usePortalSession } from '@/components/auth/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  AuditLogItemDto,
  AuthUserDto,
  createSystemUser,
  extractErrorMessage,
  formatDateTimeVn,
  getSystemConfig,
  listAuditLogs,
  listSystemUsers,
  ROLE_LABELS,
  Role,
  STATUS_LABELS,
  SystemUserDto,
  updateSystemConfig,
  updateSystemUserRoles,
  UserStatus,
} from '@/lib/auth-api';

const ALLOWED_ROLES: readonly Role[] = ['SUPERADMIN'];
const ALL_ROLES: Role[] = ['SUPERADMIN', 'ADMIN', 'TEACHER', 'STUDENT'];
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const AUDIT_PAGE_LIMIT = 20;

const PNG_BASE64_MAGIC = 'iVBORw0KGgo';
const JPEG_BASE64_MAGIC = '/9j/';

function normalizeAndVerifyLogoDataUrl(rawValue?: string | null): string | null {
  if (!rawValue) {
    return null;
  }
  const normalized = rawValue
    .trim()
    .replace(/^data:image\/jpg;base64,/i, 'data:image/jpeg;base64,');

  const pngPrefix = 'data:image/png;base64,';
  const jpegPrefix = 'data:image/jpeg;base64,';

  if (normalized.startsWith(pngPrefix)) {
    const payload = normalized.slice(pngPrefix.length);
    return payload.startsWith(PNG_BASE64_MAGIC) ? normalized : null;
  }

  if (normalized.startsWith(jpegPrefix)) {
    const payload = normalized.slice(jpegPrefix.length);
    return payload.startsWith(JPEG_BASE64_MAGIC) ? normalized : null;
  }

  return null;
}

interface SuperadminSettingsContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function SuperadminSettingsContent({
  currentUser,
  onAuthError,
}: SuperadminSettingsContentProps) {
  // Khối 1: Quản lý tài khoản Admin & Gán vai trò
  const [users, setUsers] = useState<SystemUserDto[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(true);
  const [userActionBanner, setUserActionBanner] = useState<string>('');
  const [userErrorBanner, setUserErrorBanner] = useState<string>('');

  // Modal tạo tài khoản quản trị mới
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRoles, setNewRoles] = useState<Role[]>(['ADMIN']);
  const [createError, setCreateError] = useState<string>('');
  const [creating, setCreating] = useState<boolean>(false);

  // Modal gán đa vai trò & trạng thái
  const [editingUser, setEditingUser] = useState<SystemUserDto | null>(null);
  const [editRoles, setEditRoles] = useState<Role[]>([]);
  const [editStatus, setEditStatus] = useState<UserStatus>('ACTIVE');
  const [editUserError, setEditUserError] = useState<string>('');
  const [savingUser, setSavingUser] = useState<boolean>(false);

  // Khối 2: Cấu hình hệ thống (Tên trung tâm & Logo PNG/JPG Base64)
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [centerName, setCenterName] = useState<string>('Trung Tâm TD Hán Ngữ');
  const [centerLogoBase64, setCenterLogoBase64] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string>('');
  const [configError, setConfigError] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Khối 3: Nhật ký hệ thống
  const [auditLogs, setAuditLogs] = useState<AuditLogItemDto[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditLoading, setAuditLoading] = useState<boolean>(true);
  const [refreshUsersTick, setRefreshUsersTick] = useState<number>(0);
  const [refreshAuditTick, setRefreshAuditTick] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [usersRes, cfgRes] = await Promise.allSettled([
          listSystemUsers(),
          getSystemConfig(),
        ]);
        if (cancelled) return;

        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value);
          setUserErrorBanner('');
        } else {
          if (onAuthError(usersRes.reason)) {
            return;
          }
          setUserErrorBanner(
            extractErrorMessage(
              usersRes.reason,
              'Không thể tải danh sách tài khoản hệ thống',
            ),
          );
        }

        if (cfgRes.status === 'fulfilled' && cfgRes.value) {
          setCenterName(cfgRes.value.centerName || 'Trung Tâm TD Hán Ngữ');
          setCenterLogoBase64(
            normalizeAndVerifyLogoDataUrl(
              cfgRes.value.centerLogoBase64 ?? cfgRes.value.centerLogoUrl,
            ),
          );
        } else if (cfgRes.status === 'rejected') {
          if (onAuthError(cfgRes.reason)) {
            return;
          }
        }
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUsersTick, onAuthError]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listAuditLogs({
          page: auditPage,
          limit: AUDIT_PAGE_LIMIT,
        });
        if (cancelled) return;
        setAuditLogs(response.items ?? []);
        setAuditTotal(
          response.total ?? (response.items ? response.items.length : 0),
        );
      } catch (error) {
        if (cancelled) return;
        onAuthError(error);
      } finally {
        if (!cancelled) {
          setAuditLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auditPage, refreshAuditTick, onAuthError]);

  const toggleRoleInList = (list: Role[], role: Role): Role[] => {
    if (list.includes(role)) {
      return list.filter((r) => r !== role);
    }
    return [...list, role];
  };

  const handleCreateAdminUser = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setCreateError('');

    const trimmedName = newFullName.trim();
    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedPhone = newPhone.trim();

    if (!trimmedName || trimmedName.length > 100) {
      setCreateError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setCreateError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setCreateError('Định dạng Email không hợp lệ');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setCreateError('Mật khẩu khởi tạo phải có tối thiểu 8 ký tự');
      return;
    }
    if (newRoles.length === 0) {
      setCreateError('Vui lòng chọn ít nhất một vai trò');
      return;
    }

    setCreating(true);
    try {
      await createSystemUser({
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        initialPassword: newPassword,
        roles: newRoles,
        status: 'ACTIVE',
      });
      setCreateModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNewRoles(['ADMIN']);
      setUserActionBanner('Tạo tài khoản quản trị mới thành công');
      setUsersLoading(true);
      setAuditLoading(true);
      setRefreshUsersTick((t) => t + 1);
      setRefreshAuditTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setCreateError(
        extractErrorMessage(error, 'Không thể tạo tài khoản quản trị'),
      );
    } finally {
      setCreating(false);
    }
  };

  const openEditUserModal = (user: SystemUserDto) => {
    setEditingUser(user);
    setEditRoles([...user.roles]);
    setEditStatus(user.status);
    setEditUserError('');
  };

  const handleSaveUserRoles = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!editingUser) return;
    setEditUserError('');

    if (editRoles.length === 0) {
      setEditUserError('Tài khoản phải có ít nhất một vai trò');
      return;
    }

    const isSelf = editingUser.id === currentUser.id;
    if (isSelf && editStatus === 'INACTIVE') {
      setEditUserError('Không thể tự vô hiệu hóa chính mình');
      return;
    }
    if (isSelf && !editRoles.includes('SUPERADMIN')) {
      setEditUserError('Không thể tự gỡ vai trò Superadmin của chính mình');
      return;
    }

    setSavingUser(true);
    try {
      await updateSystemUserRoles(editingUser.id, {
        roles: editRoles,
        status: editStatus,
      });
      setUserActionBanner(
        `Đã cập nhật phân quyền cho tài khoản ${editingUser.fullName}`,
      );
      setEditingUser(null);
      setUsersLoading(true);
      setAuditLoading(true);
      setRefreshUsersTick((t) => t + 1);
      setRefreshAuditTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setEditUserError(
        extractErrorMessage(
          error,
          'Không thể cập nhật vai trò (không được gỡ Superadmin cuối cùng)',
        ),
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfigError('');
    setConfigSuccess('');
    const file = event.target.files?.[0];
    if (!file) return;

    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const validExtension = /\.(png|jpe?g)$/i.test(file.name);
    if (!validMimeTypes.includes(file.type) || !validExtension) {
      setConfigError(
        'Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh PNG hoặc JPG.',
      );
      event.target.value = '';
      return;
    }

    if (file.size <= 0 || file.size > MAX_LOGO_SIZE_BYTES) {
      setConfigError('Dung lượng ảnh phải lớn hơn 0B và tối đa 2MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setConfigError('Không thể đọc dữ liệu ảnh. Vui lòng chọn lại tệp khác.');
        return;
      }
      const verifiedDataUrl = normalizeAndVerifyLogoDataUrl(reader.result);
      if (!verifiedDataUrl) {
        setConfigError(
          'Nội dung tệp không đúng chữ ký ảnh PNG hoặc JPG hợp lệ.',
        );
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
        return;
      }
      setCenterLogoBase64(verifiedDataUrl);
    };
    reader.onerror = () => {
      setConfigError('Đã xảy ra lỗi khi đọc tệp ảnh từ thiết bị.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setConfigError('');
    setConfigSuccess('');
    setCenterLogoBase64(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSaveSystemConfig = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setConfigError('');
    setConfigSuccess('');

    const trimmedCenterName = centerName.trim();
    if (!trimmedCenterName) {
      setConfigError('Tên trung tâm là trường bắt buộc');
      return;
    }

    setSavingConfig(true);
    try {
      const updated = await updateSystemConfig({
        centerName: trimmedCenterName,
        centerLogoBase64: centerLogoBase64,
      });
      setCenterName(updated.centerName);
      setCenterLogoBase64(
        normalizeAndVerifyLogoDataUrl(
          updated.centerLogoBase64 ?? updated.centerLogoUrl,
        ),
      );
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      setConfigSuccess('Lưu cấu hình hệ thống thành công');
      setAuditLoading(true);
      setRefreshAuditTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setConfigError(
        extractErrorMessage(error, 'Không thể lưu cấu hình hệ thống'),
      );
    } finally {
      setSavingConfig(false);
    }
  };

  const totalAuditPages = Math.max(
    1,
    Math.ceil(auditTotal / AUDIT_PAGE_LIMIT),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={currentUser} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-emerald-950">
            Vận Hành Hệ Thống (Superadmin)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quản lý tài khoản quản trị, gán đa vai trò, cấu hình thương hiệu
            trung tâm và giám sát nhật ký hệ thống
          </p>
        </div>

        {/* KHỐI 1: Quản lý tài khoản Admin & Gán vai trò */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                1. Quản lý tài khoản Admin & Gán đa vai trò
              </h2>
              <p className="text-xs text-slate-500">
                Thiết lập vai trò (Superadmin / Admin / Giáo viên / Học viên).
                Không cho phép tự vô hiệu hóa chính mình hoặc gỡ Superadmin cuối
                cùng.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateError('');
                setCreateModalOpen(true);
              }}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
            >
              + Thêm tài khoản quản trị
            </button>
          </div>

          {userActionBanner ? (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
            >
              {userActionBanner}
            </div>
          ) : null}

          {userErrorBanner ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
            >
              {userErrorBanner}
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Họ và tên</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Số điện thoại</th>
                  <th className="px-4 py-3">Vai trò được gán</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {usersLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Đang tải danh sách tài khoản...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Chưa có dữ liệu tài khoản quản trị.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {u.fullName}
                        {currentUser.id === u.id ? (
                          <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                            Bạn
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{u.email}</td>
                      <td className="px-4 py-3 text-slate-700">{u.phone}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <span
                              key={r}
                              className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200"
                            >
                              {ROLE_LABELS[r] ?? r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : u.status === 'PENDING_CLASS'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {STATUS_LABELS[u.status] ?? u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditUserModal(u)}
                          className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          Phân quyền & Trạng thái
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* KHỐI 2: Cấu hình hệ thống */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">
              2. Cấu hình hệ thống
            </h2>
            <p className="text-xs text-slate-500">
              Cập nhật Tên trung tâm và tải ảnh Logo hiển thị trên thanh điều
              hướng cùng màn hình Đăng nhập
            </p>
          </div>

          {configSuccess ? (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
            >
              {configSuccess}
            </div>
          ) : null}

          {configError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
            >
              {configError}
            </div>
          ) : null}

          <form
            onSubmit={(e) => void handleSaveSystemConfig(e)}
            noValidate
            className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2"
          >
            <div className="space-y-2">
              <label
                htmlFor="cfg-center-name"
                className="block text-sm font-medium text-slate-800"
              >
                Tên trung tâm <span className="text-red-600">*</span>
              </label>
              <input
                id="cfg-center-name"
                type="text"
                required
                value={centerName}
                onChange={(e) => setCenterName(e.target.value)}
                placeholder="Trung Tâm TD Hán Ngữ"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="cfg-center-logo"
                className="block text-sm font-medium text-slate-800"
              >
                Logo trung tâm (Tệp ảnh PNG / JPG, tối đa 2MB)
              </label>
              <div className="flex flex-wrap items-center gap-4">
                {centerLogoBase64 ? (
                  <Image
                    src={centerLogoBase64}
                    alt="Xem trước logo trung tâm"
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 shrink-0 rounded-xl border border-emerald-200 bg-white object-contain p-1 shadow-sm"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-sm">
                    TD
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    ref={logoInputRef}
                    id="cfg-center-logo"
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    onChange={handleLogoFileChange}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-emerald-800 hover:file:bg-emerald-100"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">
                      Tải trực tiếp tệp PNG hoặc JPG từ thiết bị (tối đa 2MB, tự
                      động xác thực chữ ký tệp nhị phân).
                    </p>
                    {centerLogoBase64 ? (
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                      >
                        Xóa logo
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={savingConfig}
                className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {savingConfig
                  ? 'Đang lưu cấu hình...'
                  : 'Lưu cấu hình hệ thống'}
              </button>
            </div>
          </form>
        </section>

        {/* KHỐI 3: Nhật ký hệ thống (dd/mm/yyyy HH:mm:ss, mới nhất lên đầu, read-only) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-900">
              3. Nhật ký hệ thống (Chỉ xem)
            </h2>
            <p className="text-xs text-slate-500">
              Ghi vết kiểm toán mọi thao tác quản trị (Thời gian định dạng
              dd/mm/yyyy HH:mm:ss, sắp xếp mới nhất lên đầu)
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Người thao tác</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {auditLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Đang tải nhật ký hệ thống...
                    </td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Chưa có bản ghi nhật ký hệ thống.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    const actorLabel =
                      log.actor?.fullName ||
                      log.actorName ||
                      log.actor?.email ||
                      log.actorEmail ||
                      log.actorId ||
                      'Hệ thống';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                          {formatDateTimeVn(log.createdAt, true)}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {actorLabel}
                          {log.actingRole ? (
                            <span className="ml-1.5 text-xs text-slate-500">
                              ({ROLE_LABELS[log.actingRole] ?? log.actingRole})
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700">
                          {log.targetType}
                          {log.targetId ? ` (#${log.targetId.slice(0, 8)})` : ''}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>
              Trang {auditPage} / {totalAuditPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={auditPage <= 1}
                onClick={() => {
                  setAuditLoading(true);
                  setAuditPage((p) => Math.max(1, p - 1));
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={auditPage >= totalAuditPages}
                onClick={() => {
                  setAuditLoading(true);
                  setAuditPage((p) => Math.min(totalAuditPages, p + 1));
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Modal Tạo tài khoản quản trị */}
      {createModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-emerald-950">
              Tạo Tài Khoản Quản Trị Mới
            </h2>

            {createError ? (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                {createError}
              </div>
            ) : null}

            <form
              onSubmit={(e) => void handleCreateAdminUser(e)}
              noValidate
              className="mt-4 space-y-4"
            >
              <div className="space-y-1">
                <label
                  htmlFor="sys-new-name"
                  className="block text-sm font-medium text-slate-800"
                >
                  Họ và tên <span className="text-red-600">*</span>
                </label>
                <input
                  id="sys-new-name"
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label
                    htmlFor="sys-new-phone"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Số điện thoại <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="sys-new-phone"
                    type="tel"
                    maxLength={10}
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="sys-new-email"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="sys-new-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <PasswordInput
                id="sys-new-password"
                label="Mật khẩu khởi tạo"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
              />

              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-800">
                  Gán vai trò (Chọn nhiều vai trò){' '}
                  <span className="text-red-600">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {ALL_ROLES.map((role) => (
                    <label
                      key={role}
                      className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newRoles.includes(role)}
                        onChange={() =>
                          setNewRoles((prev) => toggleRoleInList(prev, role))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                      />
                      <span>{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal Gán đa vai trò & Cập nhật trạng thái */}
      {editingUser ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-emerald-950">
              Gán Đa Vai Trò & Trạng Thái
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Tài khoản: <strong>{editingUser.fullName}</strong> (
              {editingUser.email})
            </p>

            {editUserError ? (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                {editUserError}
              </div>
            ) : null}

            <form
              onSubmit={(e) => void handleSaveUserRoles(e)}
              noValidate
              className="mt-4 space-y-4"
            >
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-800">
                  Vai trò (Chọn một hoặc nhiều vai trò)
                </span>
                <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  {ALL_ROLES.map((role) => (
                    <label
                      key={role}
                      className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editRoles.includes(role)}
                        onChange={() =>
                          setEditRoles((prev) => toggleRoleInList(prev, role))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                      />
                      <span>{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="edit-sys-status"
                  className="block text-sm font-medium text-slate-800"
                >
                  Trạng thái tài khoản
                </label>
                <select
                  id="edit-sys-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
                >
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Vô hiệu hóa</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {savingUser ? 'Đang lưu...' : 'Lưu phân quyền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SuperadminSettingsPage() {
  const { status, user, errorMessage, handleApiAuthError } =
    usePortalSession(ALLOWED_ROLES);

  if (status !== 'authorized' || !user) {
    return (
      <PortalGuardView
        status={status === 'authorized' ? 'checking' : status}
        currentUser={user}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <SuperadminSettingsContent
      currentUser={user}
      onAuthError={handleApiAuthError}
    />
  );
}
