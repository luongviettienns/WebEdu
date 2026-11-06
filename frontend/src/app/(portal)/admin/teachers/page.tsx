'use client';

import React, { useEffect, useState } from 'react';
import { PortalGuardView } from '@/components/auth/AccessDeniedState';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { usePortalSession } from '@/components/auth/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  AuthUserDto,
  createTeacher,
  extractErrorMessage,
  listTeachers,
  Role,
  STATUS_LABELS,
  TeacherItemDto,
  updateTeacher,
  UserStatus,
} from '@/lib/auth-api';

const PAGE_LIMIT = 20;
const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'SUPERADMIN'];

interface AdminTeachersContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function AdminTeachersContent({
  currentUser,
  onAuthError,
}: AdminTeachersContentProps) {
  const [teachers, setTeachers] = useState<TeacherItemDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');

  // Modal Tạo / Sửa / Xem Giáo viên
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>(
    'create',
  );
  const [selectedTeacher, setSelectedTeacher] =
    useState<TeacherItemDto | null>(null);

  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [initialPassword, setInitialPassword] = useState<string>('');
  const [status, setStatus] = useState<UserStatus>('ACTIVE');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Popup chặn vô hiệu hóa GV đang phụ trách lớp
  const [blockedTeacherAlert, setBlockedTeacherAlert] = useState<{
    name: string;
    activeClassesCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listTeachers({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          page,
          limit: PAGE_LIMIT,
        });
        if (cancelled) return;
        setTeachers(response.items ?? []);
        setTotal(
          response.total ?? (response.items ? response.items.length : 0),
        );
        setErrorBanner('');
      } catch (error) {
        if (cancelled) return;
        if (onAuthError(error)) {
          return;
        }
        setErrorBanner(
          extractErrorMessage(error, 'Không thể tải danh sách giáo viên'),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search, statusFilter, page, refreshTick, onAuthError]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedTeacher(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setInitialPassword('');
    setStatus('ACTIVE');
    setNotes('');
    setFormError('');
    setModalOpen(true);
  };

  const openTeacherModal = (
    teacher: TeacherItemDto,
    mode: 'edit' | 'view',
  ) => {
    setModalMode(mode);
    setSelectedTeacher(teacher);
    setFullName(teacher.fullName);
    setPhone(teacher.phone);
    setEmail(teacher.email);
    setInitialPassword('');
    setStatus(teacher.status);
    setNotes(teacher.notes ?? '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveTeacher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (modalMode === 'view') {
      setModalOpen(false);
      return;
    }

    setFormError('');
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length > 100) {
      setFormError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setFormError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Định dạng Email không hợp lệ');
      return;
    }

    if (modalMode === 'create') {
      if (!initialPassword || initialPassword.length < 8) {
        setFormError('Mật khẩu khởi tạo bắt buộc và tối thiểu 8 ký tự');
        return;
      }
    } else if (
      selectedTeacher &&
      status === 'INACTIVE' &&
      selectedTeacher.activeClassesCount > 0
    ) {
      setFormError(
        `Giáo viên đang phụ trách ${selectedTeacher.activeClassesCount} lớp. Vui lòng phân công giáo viên khác`,
      );
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === 'create') {
        await createTeacher({
          fullName: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          initialPassword,
          notes: notes.trim() || undefined,
        });
        setSuccessBanner('Tạo tài khoản giáo viên mới thành công');
      } else if (selectedTeacher) {
        await updateTeacher(selectedTeacher.id, {
          fullName: trimmedName,
          phone: trimmedPhone,
          email: trimmedEmail,
          status,
          notes: notes.trim(),
        });
        setSuccessBanner('Cập nhật thông tin giáo viên thành công');
      }
      setModalOpen(false);
      setLoading(true);
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setFormError(
        extractErrorMessage(error, 'Không thể lưu thông tin giáo viên'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTeacherStatus = async (teacher: TeacherItemDto) => {
    setErrorBanner('');
    setSuccessBanner('');

    if (teacher.status === 'ACTIVE' && teacher.activeClassesCount > 0) {
      setBlockedTeacherAlert({
        name: teacher.fullName,
        activeClassesCount: teacher.activeClassesCount,
      });
      return;
    }

    const nextStatus: UserStatus =
      teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await updateTeacher(teacher.id, { status: nextStatus });
      setSuccessBanner(
        nextStatus === 'INACTIVE'
          ? `Đã vô hiệu hóa tài khoản giáo viên ${teacher.fullName}`
          : `Đã kích hoạt lại tài khoản giáo viên ${teacher.fullName}`,
      );
      setLoading(true);
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setErrorBanner(
        extractErrorMessage(
          error,
          'Không thể thay đổi trạng thái tài khoản giáo viên',
        ),
      );
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentUser={currentUser} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-emerald-950">
              Quản Lý Tài Khoản Giáo Viên
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tạo mới, cập nhật thông tin và quản lý trạng thái hoạt động của
              đội ngũ giảng viên HSK
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
          >
            + Tạo tài khoản giáo viên
          </button>
        </div>

        {/* Bộ lọc & Tìm kiếm */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setLoading(true);
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo Họ tên, Số điện thoại hoặc Email..."
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <select
              aria-label="Lọc theo trạng thái"
              value={statusFilter}
              onChange={(e) => {
                setLoading(true);
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Vô hiệu hóa</option>
            </select>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Tổng số: <strong>{total}</strong> giáo viên
          </span>
        </div>

        {successBanner ? (
          <div
            role="status"
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-900"
          >
            {successBanner}
          </div>
        ) : null}

        {errorBanner ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-700"
          >
            {errorBanner}
          </div>
        ) : null}

        {/* Bảng danh sách Giáo viên */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">STT</th>
                  <th className="px-4 py-3.5">Họ và tên</th>
                  <th className="px-4 py-3.5">Số điện thoại</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5 text-center">
                    Số lớp đang phụ trách
                  </th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Đang tải danh sách giáo viên...
                    </td>
                  </tr>
                ) : teachers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Không tìm thấy giáo viên phù hợp.
                    </td>
                  </tr>
                ) : (
                  teachers.map((teacher, idx) => {
                    const isTeacherAdmin =
                      teacher.isAdmin ||
                      (Array.isArray(teacher.roles) &&
                        teacher.roles.includes('ADMIN'));
                    return (
                      <tr
                        key={teacher.id}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-medium text-slate-500">
                          {(page - 1) * PAGE_LIMIT + idx + 1}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {teacher.fullName}
                            </span>
                            {isTeacherAdmin ? (
                              <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-300">
                                Admin
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {teacher.phone}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {teacher.email}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                          {teacher.activeClassesCount ?? 0}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              teacher.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {STATUS_LABELS[teacher.status] ?? teacher.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openTeacherModal(teacher, 'view')}
                              className="rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Xem
                            </button>
                            <button
                              type="button"
                              onClick={() => openTeacherModal(teacher, 'edit')}
                              className="rounded-md px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleTeacherStatus(teacher)
                              }
                              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                                teacher.status === 'ACTIVE'
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {teacher.status === 'ACTIVE'
                                ? 'Vô hiệu hóa'
                                : 'Kích hoạt'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang 20 dòng/trang */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang {page} / {totalPages} (Hiển thị tối đa {PAGE_LIMIT}{' '}
              dòng/trang)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => Math.min(totalPages, p + 1));
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Popup cảnh báo chặn vô hiệu hóa GV đang phụ trách lớp */}
      {blockedTeacherAlert ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              Không thể vô hiệu hóa giáo viên
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Giáo viên đang phụ trách{' '}
              <strong>{blockedTeacherAlert.activeClassesCount}</strong> lớp. Vui
              lòng phân công giáo viên khác.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setBlockedTeacherAlert(null)}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Tạo / Sửa / Xem Giáo viên */}
      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-emerald-950">
                {modalMode === 'create'
                  ? 'Tạo Tài Khoản Giáo Viên Mới'
                  : modalMode === 'edit'
                    ? 'Cập Nhật Thông Tin Giáo Viên'
                    : 'Chi Tiết Hồ Sơ Giáo Viên'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>

            {formError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                {formError}
              </div>
            ) : null}

            <form
              onSubmit={(e) => void handleSaveTeacher(e)}
              noValidate
              className="mt-4 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="teacher-fullname"
                  className="block text-sm font-medium text-slate-800"
                >
                  Họ và tên <span className="text-red-600">*</span>
                </label>
                <input
                  id="teacher-fullname"
                  type="text"
                  maxLength={100}
                  disabled={modalMode === 'view'}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="teacher-phone"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Số điện thoại <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="teacher-phone"
                    type="tel"
                    maxLength={10}
                    disabled={modalMode === 'view'}
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="teacher-email"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="teacher-email"
                    type="email"
                    disabled={modalMode === 'view'}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                  />
                </div>
              </div>

              {modalMode === 'create' ? (
                <PasswordInput
                  id="teacher-init-password"
                  label="Mật khẩu khởi tạo"
                  required
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  hint="Hệ thống sẽ kích hoạt tài khoản với mật khẩu khởi tạo này"
                />
              ) : (
                <div className="space-y-1.5">
                  <label
                    htmlFor="teacher-status"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Trạng thái hoạt động
                  </label>
                  <select
                    id="teacher-status"
                    disabled={modalMode === 'view'}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as UserStatus)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                  >
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="INACTIVE">Vô hiệu hóa</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="teacher-notes"
                  className="block text-sm font-medium text-slate-800"
                >
                  Ghi chú chuyên môn
                </label>
                <textarea
                  id="teacher-notes"
                  rows={3}
                  disabled={modalMode === 'view'}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Chứng chỉ HSK, ca dạy ưu tiên..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {modalMode === 'view' ? 'Đóng' : 'Hủy'}
                </button>
                {modalMode !== 'view' ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminTeachersPage() {
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
    <AdminTeachersContent
      currentUser={user}
      onAuthError={handleApiAuthError}
    />
  );
}
