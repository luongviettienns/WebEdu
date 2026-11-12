'use client';

import React, { useState } from 'react';
import {
  updateMyProfile,
  type UserProfileDto,
} from '@/features/profile/api/profile.api';
import {
  extractErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
} from '@/lib/api-client';

interface UsePersonalInfoFormArgs {
  profile: UserProfileDto;
  onProfileUpdated: React.Dispatch<React.SetStateAction<UserProfileDto | null>>;
  onAuthError: (error: unknown) => boolean;
}

export function usePersonalInfoForm({
  profile,
  onProfileUpdated,
  onAuthError,
}: UsePersonalInfoFormArgs) {
  const [fullName, setFullName] = useState<string>(profile.fullName ?? '');
  const [phone, setPhone] = useState<string>(profile.phone ?? '');
  const [email, setEmail] = useState<string>(profile.email ?? '');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState<string>('');

  const [profileSubmitting, setProfileSubmitting] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');

  const emailChanged =
    email.trim().toLowerCase() !== profile.email.trim().toLowerCase();
  const isStudent = (profile.roles ?? []).includes('STUDENT');

  const handleUpdateProfile = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length > 100) {
      setProfileError('Họ và tên bắt buộc và tối đa 100 ký tự');
      return;
    }
    if (!/^0\d{9}$/.test(trimmedPhone)) {
      setProfileError(
        'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0',
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError('Định dạng Email không hợp lệ');
      return;
    }
    if (emailChanged && !emailConfirmPassword) {
      setProfileError('Vui lòng nhập mật khẩu hiện tại để xác nhận đổi Email');
      return;
    }

    setProfileSubmitting(true);
    try {
      const updated = await updateMyProfile({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        ...(emailChanged ? { currentPassword: emailConfirmPassword } : {}),
      });
      onProfileUpdated(updated);
      setFullName(updated.fullName ?? trimmedName);
      setPhone(updated.phone ?? trimmedPhone);
      setEmail(updated.email ?? trimmedEmail);
      setEmailConfirmPassword('');
      setProfileSuccess('Cập nhật thông tin cá nhân thành công');
    } catch (error) {
      if (isForbiddenError(error)) {
        onAuthError(error);
        return;
      }
      const message = extractErrorMessage(
        error,
        'Không thể cập nhật thông tin cá nhân',
      );
      if (
        isUnauthorizedError(error) &&
        !(emailChanged && /mật khẩu|password/i.test(message))
      ) {
        onAuthError(error);
        return;
      }
      setProfileError(message);
    } finally {
      setProfileSubmitting(false);
    }
  };

  return {
    fullName,
    setFullName,
    phone,
    setPhone,
    email,
    setEmail,
    emailConfirmPassword,
    setEmailConfirmPassword,
    profileSubmitting,
    profileSuccess,
    profileError,
    emailChanged,
    isStudent,
    handleUpdateProfile,
  };
}
