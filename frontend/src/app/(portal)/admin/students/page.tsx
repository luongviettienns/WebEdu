'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { PortalGuardView } from '@/components/auth/AccessDeniedState';
import { usePortalSession } from '@/components/auth/usePortalSession';
import { AppHeader } from '@/components/layout/AppHeader';
import {
  AuthUserDto,
  calculateAgeInVnTimezone,
  extractErrorMessage,
  formatDateDdMmYyyy,
  formatDateTimeVn,
  getStudentDetail,
  listStudents,
  Role,
  STATUS_LABELS,
  StudentItemDto,
  updateStudent,
  UserStatus,
} from '@/lib/auth-api';

const PAGE_LIMIT = 20;
const ALLOWED_ROLES: readonly Role[] = ['ADMIN', 'SUPERADMIN'];

function normalizeIsoDateForInput(iso?: string | null): string {
  if (!iso) return '';
  return iso.includes('T') ? (iso.split('T')[0] ?? '') : iso;
}

interface AdminStudentsContentProps {
  currentUser: AuthUserDto;
  onAuthError: (error: unknown) => boolean;
}

function AdminStudentsContent({
  currentUser,
  onAuthError,
}: AdminStudentsContentProps) {
  const [students, setStudents] = useState<StudentItemDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [successBanner, setSuccessBanner] = useState<string>('');

  // Hồ sơ chi tiết học viên
  const [selectedStudent, setSelectedStudent] =
    useState<StudentItemDto | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const activeDetailStudentIdRef = useRef<string | null>(null);

  const [editFullName, setEditFullName] = useState<string>('');
  const [originalDateOfBirth, setOriginalDateOfBirth] = useState<string>('');
  const [editDateOfBirth, setEditDateOfBirth] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editStatus, setEditStatus] = useState<UserStatus>('PENDING_CLASS');
  const [editInternalNotes, setEditInternalNotes] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const canManageInternalNotes = currentUser.roles.includes('ADMIN');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listStudents({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          className: classFilter.trim() || undefined,
          page,
          limit: PAGE_LIMIT,
        });
        if (cancelled) return;
        setStudents(response.items ?? []);
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
          extractErrorMessage(error, 'Không thể tải danh sách học viên'),
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
  }, [search, statusFilter, classFilter, page, refreshTick, onAuthError]);

  const closeStudentModal = () => {
    activeDetailStudentIdRef.current = null;
    setSelectedStudent(null);
    setOriginalDateOfBirth('');
    setModalError('');
  };

  const openStudentProfile = async (student: StudentItemDto) => {
    const initialDob = normalizeIsoDateForInput(student.dateOfBirth);
    activeDetailStudentIdRef.current = student.id;
    setModalError('');
    setSelectedStudent(student);
    setEditFullName(student.fullName);
    setOriginalDateOfBirth(initialDob);
    setEditDateOfBirth(initialDob);
    setEditPhone(student.phone);
    setEditEmail(student.email);
    setEditStatus(student.status);
    setEditInternalNotes(student.internalNotes ?? '');

    setDetailLoading(true);
    try {
      const fullDetail = await getStudentDetail(student.id);
      if (activeDetailStudentIdRef.current !== student.id) {
        return;
      }
      const detailDob = normalizeIsoDateForInput(fullDetail.dateOfBirth);
      setSelectedStudent(fullDetail);
      setEditFullName(fullDetail.fullName);
      setOriginalDateOfBirth(detailDob);
      setEditDateOfBirth(detailDob);
      setEditPhone(fullDetail.phone);
      setEditEmail(fullDetail.email);
      setEditStatus(fullDetail.status);
      setEditInternalNotes(fullDetail.internalNotes ?? '');
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      // Giữ thông tin từ dòng danh sách nếu gọi chi tiết không phản hồi
    } finally {
      if (activeDetailStudentIdRef.current === student.id) {
        setDetailLoading(false);
      }
    }
  };

  const isGuardianConsentLocked = Boolean(
    selectedStudent?.dateOfBirthLocked ||
      selectedStudent?.hasGuardianConsent ||
      selectedStudent?.guardianConsent,
  );

  const isSelectedStudentEnrolled = Boolean(
    selectedStudent?.enrolledAt ||
      selectedStudent?.currentClassId ||
      selectedStudent?.assignedClass,
  );

  const computedAge =
    calculateAgeInVnTimezone(editDateOfBirth) ??
    selectedStudent?.age ??
    null;

  const handleSaveStudent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudent) return;
    setModalError('');

    const trimmedName = editFullName.trim();
    const trimmedPhone = editPhone.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();
    const normalizedEditDob = editDateOfBirth.trim();

    if (!trimmedName || trimmedName.length > 100) {
      setModalError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setModalError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setModalError('Định dạng Email không hợp lệ');
      return;
    }

    const hasDateOfBirthChanged =
      !isGuardianConsentLocked && normalizedEditDob !== originalDateOfBirth;

    if (hasDateOfBirthChanged) {
      if (!normalizedEditDob || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedEditDob)) {
        setModalError('Định dạng Ngày sinh không hợp lệ');
        return;
      }
    }

    setSaving(true);
    try {
      await updateStudent(selectedStudent.id, {
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        ...(hasDateOfBirthChanged ? { dateOfBirth: normalizedEditDob } : {}),
        status: editStatus,
        ...(canManageInternalNotes
          ? { internalNotes: editInternalNotes.trim() }
          : {}),
      });
      setSuccessBanner(
        `Đã cập nhật hồ sơ học viên ${trimmedName} thành công`,
      );
      closeStudentModal();
      setLoading(true);
      setRefreshTick((t) => t + 1);
    } catch (error) {
      if (onAuthError(error)) {
        return;
      }
      setModalError(
        extractErrorMessage(error, 'Không thể lưu hồ sơ học viên'),
      );
    } finally {
      setSaving(false);
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
              Quản Lý Hồ Sơ Học Viên
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Tra cứu thông tin học viên, đối soát xác nhận đồng ý của cha mẹ và
              cập nhật trạng thái tài khoản
            </p>
          </div>
          {canManageInternalNotes ? (
            <Link
              href="/admin/students/pending"
              className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 transition-colors"
            >
              Danh sách chờ xếp lớp
            </Link>
          ) : null}
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
              className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <input
              type="text"
              value={classFilter}
              onChange={(e) => {
                setLoading(true);
                setClassFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Lọc theo lớp học..."
              className="w-44 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <select
              aria-label="Lọc theo trạng thái tài khoản"
              value={statusFilter}
              onChange={(e) => {
                setLoading(true);
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING_CLASS">Chờ xếp lớp</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Vô hiệu hóa</option>
            </select>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Tổng số: <strong>{total}</strong> học viên
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

        {/* Bảng danh sách Học viên */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3.5">STT</th>
                  <th className="px-4 py-3.5">Họ và tên</th>
                  <th className="px-4 py-3.5">Ngày sinh</th>
                  <th className="px-4 py-3.5">Số điện thoại</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Lớp đang học</th>
                  <th className="px-4 py-3.5">Trạng thái tài khoản</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Đang tải danh sách học viên...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Không tìm thấy hồ sơ học viên phù hợp.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-medium text-slate-500">
                        {(page - 1) * PAGE_LIMIT + idx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {student.fullName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {formatDateDdMmYyyy(student.dateOfBirth)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {student.phone}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {student.email}
                      </td>
                      <td className="px-4 py-3.5 text-slate-800">
                        {student.assignedClass || (
                          <span className="text-xs italic text-slate-400">
                            Chưa xếp lớp
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            student.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : student.status === 'PENDING_CLASS'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {STATUS_LABELS[student.status] ?? student.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => void openStudentProfile(student)}
                          className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        >
                          Chi tiết & Sửa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang {page} / {totalPages}
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

      {/* Modal Hồ Sơ Chi Tiết Học Viên */}
      {selectedStudent ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
        >
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-emerald-950">
                  Hồ Sơ Chi Tiết Học Viên
                </h2>
                <p className="text-xs text-slate-500">
                  Quản lý thông tin cá nhân, trạng thái tài khoản và ghi chú nội
                  bộ
                </p>
              </div>
              <button
                type="button"
                onClick={closeStudentModal}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Đóng
              </button>
            </div>

            {detailLoading ? (
              <p className="mt-3 text-xs text-slate-500">
                Đang đồng bộ dữ liệu chi tiết...
              </p>
            ) : null}

            {modalError ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700"
              >
                {modalError}
              </div>
            ) : null}

            <form
              onSubmit={(e) => void handleSaveStudent(e)}
              noValidate
              className="mt-4 space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="stu-fullname"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Họ và tên <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="stu-fullname"
                    type="text"
                    maxLength={100}
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="stu-dob"
                      className="block text-sm font-medium text-slate-800"
                    >
                      Ngày sinh ({formatDateDdMmYyyy(editDateOfBirth)})
                    </label>
                    {computedAge !== null ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        Tuổi: {computedAge}
                      </span>
                    ) : null}
                  </div>
                  <input
                    id="stu-dob"
                    type="date"
                    disabled={isGuardianConsentLocked}
                    value={editDateOfBirth}
                    onChange={(e) => setEditDateOfBirth(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                  {isGuardianConsentLocked ? (
                    <p className="text-[11px] font-medium text-amber-800">
                      Trường Ngày sinh đã khóa do học viên có xác nhận đồng ý
                      của cha mẹ.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="stu-phone"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Số điện thoại <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="stu-phone"
                    type="tel"
                    maxLength={10}
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="stu-email"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="stu-email"
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              {/* Xác nhận đồng ý của cha mẹ (nếu có) */}
              {selectedStudent.guardianConsent ||
              selectedStudent.hasGuardianConsent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                  <p className="text-xs font-semibold text-emerald-900">
                    Đã xác nhận đồng ý của cha mẹ –{' '}
                    {selectedStudent.guardianConsent?.consentedAt
                      ? formatDateTimeVn(
                          selectedStudent.guardianConsent.consentedAt,
                        )
                      : 'Khi đăng ký'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Email phụ huynh:{' '}
                    <strong>
                      {selectedStudent.guardianConsent?.guardianEmail ||
                        selectedStudent.guardianEmail ||
                        'Đã lưu'}
                    </strong>
                  </p>
                </div>
              ) : null}

              {/* Lớp đang học, Lịch sử lớp & Trạng thái tài khoản */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-slate-800">
                    Lớp đang học & Lịch sử lớp
                  </span>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800">
                    <p className="font-semibold">
                      Hiện tại:{' '}
                      {selectedStudent.assignedClass || 'Chưa xếp lớp'}
                    </p>
                    {selectedStudent.classHistory &&
                    selectedStudent.classHistory.length > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Đã học: {selectedStudent.classHistory.join(', ')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="stu-status"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Trạng thái tài khoản
                  </label>
                  <select
                    id="stu-status"
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as UserStatus)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
                  >
                    {!isSelectedStudentEnrolled ? (
                      <>
                        <option value="PENDING_CLASS">Chờ xếp lớp</option>
                        <option value="INACTIVE">Vô hiệu hóa</option>
                      </>
                    ) : (
                      <>
                        <option value="ACTIVE">Đang hoạt động</option>
                        <option value="INACTIVE">Vô hiệu hóa</option>
                      </>
                    )}
                  </select>
                  {!isSelectedStudentEnrolled ? (
                    <p className="text-[11px] text-slate-600">
                      Để kích hoạt sang <strong>Đang hoạt động</strong>, vui lòng
                      thực hiện tại{' '}
                      <Link
                        href="/admin/students/pending"
                        className="font-semibold text-emerald-700 underline hover:text-emerald-800"
                      >
                        Danh sách chờ xếp lớp
                      </Link>
                      .
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Ghi chú nội bộ — Chỉ hiển thị và cập nhật đối với Admin (FUNC-007, FUNC-013) */}
              {canManageInternalNotes ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="stu-internal-notes"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Ghi chú nội bộ (Chỉ Admin xem)
                  </label>
                  <textarea
                    id="stu-internal-notes"
                    rows={3}
                    value={editInternalNotes}
                    onChange={(e) => setEditInternalNotes(e.target.value)}
                    placeholder="Ghi chú xếp lớp, nhu cầu học tập, lưu ý phụ huynh..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeStudentModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || detailLoading}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminStudentsPage() {
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
    <AdminStudentsContent
      currentUser={user}
      onAuthError={handleApiAuthError}
    />
  );
}
