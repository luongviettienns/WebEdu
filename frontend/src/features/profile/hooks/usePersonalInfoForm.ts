'use client';

import React, { useEffect, useState } from 'react';
import {
  sendEmailChangeCode,
  updateMyProfile,
  type UserProfileDto,
} from '@/features/profile/api/profile.api';
import {
  extractErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
} from '@/lib/api-client';
import { calculateAgeInVnTimezone } from '@/lib/utils/date';

interface UsePersonalInfoFormArgs {
  profile: UserProfileDto;
  onProfileUpdated: React.Dispatch<React.SetStateAction<UserProfileDto | null>>;
  onAuthError: (error: unknown) => boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export function usePersonalInfoForm({
  profile,
  onProfileUpdated,
  onAuthError,
}: UsePersonalInfoFormArgs) {
  const [fullName, setFullName] = useState<string>(profile.fullName ?? '');
  const [phone, setPhone] = useState<string>(profile.phone ?? '');
  const [email, setEmail] = useState<string>(profile.email ?? '');
  const [emailConfirmPassword, setEmailConfirmPassword] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');

  const [sendingCode, setSendingCode] = useState<boolean>(false);
  const [codeFeedback, setCodeFeedback] = useState<string>('');
  const [codeError, setCodeError] = useState<string>('');
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const [profileSubmitting, setProfileSubmitting] = useState<boolean>(false);
  const [profileSuccess, setProfileSuccess] = useState<string>('');
  const [profileError, setProfileError] = useState<string>('');

  const isStudent = (profile.roles ?? []).includes('STUDENT');
  const vnAge = profile.dateOfBirth
    ? calculateAgeInVnTimezone(profile.dateOfBirth)
    : null;
  const isUnder16EmailLocked =
    profile.canSelfChangeEmail === false || (vnAge !== null && vnAge < 16);

  const activeEmail = isUnder16EmailLocked ? profile.email : email;
  const emailChanged =
    !isUnder16EmailLocked &&
    activeEmail.trim().toLowerCase() !== profile.email.trim().toLowerCase();

  const isCoolingDown = cooldownSeconds > 0;

  useEffect(() => {
    if (!isCoolingDown) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isCoolingDown]);

  const handleEmailChange = (nextEmail: string) => {
    if (isUnder16EmailLocked) return;
    const prevNormalized = email.trim().toLowerCase();
    const nextNormalized = nextEmail.trim().toLowerCase();
    setEmail(nextEmail);
    if (nextNormalized !== prevNormalized) {
      setVerificationCode('');
      setCodeFeedback('');
      setCodeError('');
      setCooldownSeconds(0);
    }
  };

  const requestEmailChangeCode = async () => {
    if (isUnder16EmailLocked || sendingCode || cooldownSeconds > 0) return;
    setCodeError('');
    setCodeFeedback('');
    setProfileError('');

    const trimmedEmail = activeEmail.trim().toLowerCase();
    if (trimmedEmail === profile.email.trim().toLowerCase()) {
      setCodeError('Email mới phải khác email hiện tại');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setCodeError('Định dạng Email không hợp lệ');
      return;
    }

    setSendingCode(true);
    try {
      const response = await sendEmailChangeCode(trimmedEmail);
      setCodeFeedback(
        response.message || 'Mã xác thực 6 chữ số đã được gửi tới email mới',
      );
      setCooldownSeconds(OTP_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        onAuthError(error);
        return;
      }
      const message = extractErrorMessage(
        error,
        'Không thể gửi mã xác thực tới email mới',
      );
      if (isForbiddenError(error) && !/16 tuổi|email/i.test(message)) {
        onAuthError(error);
        return;
      }
      setCodeError(message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleUpdateProfile = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = activeEmail.trim().toLowerCase();

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
    if (!isUnder16EmailLocked && !EMAIL_PATTERN.test(trimmedEmail)) {
      setProfileError('Định dạng Email không hợp lệ');
      return;
    }
    if (emailChanged && !emailConfirmPassword) {
      setProfileError('Vui lòng nhập mật khẩu hiện tại để xác nhận đổi Email');
      return;
    }
    if (emailChanged && !/^\d{6}$/.test(verificationCode.trim())) {
      setProfileError(
        'Vui lòng nhập mã xác thực 6 chữ số đã gửi tới email mới',
      );
      return;
    }

    setProfileSubmitting(true);
    try {
      const updated = await updateMyProfile({
        fullName: trimmedName,
        phone: trimmedPhone,
        ...(isUnder16EmailLocked ? {} : { email: trimmedEmail }),
        ...(emailChanged
          ? {
              currentPassword: emailConfirmPassword,
              verificationCode: verificationCode.trim(),
            }
          : {}),
      });
      onProfileUpdated(updated);
      setFullName(updated.fullName ?? trimmedName);
      setPhone(updated.phone ?? trimmedPhone);
      setEmail(updated.email ?? trimmedEmail);
      setEmailConfirmPassword('');
      setVerificationCode('');
      setCodeFeedback('');
      setCodeError('');
      setCooldownSeconds(0);
      setProfileSuccess('Cập nhật thông tin cá nhân thành công');
    } catch (error) {
      const message = extractErrorMessage(
        error,
        'Không thể cập nhật thông tin cá nhân',
      );
      if (isForbiddenError(error) && !/16 tuổi|email/i.test(message)) {
        onAuthError(error);
        return;
      }
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
    email: activeEmail,
    setEmail: handleEmailChange,
    emailConfirmPassword,
    setEmailConfirmPassword,
    verificationCode,
    setVerificationCode,
    sendingCode,
    codeFeedback,
    codeError,
    cooldownSeconds,
    requestEmailChangeCode,
    profileSubmitting,
    profileSuccess,
    profileError,
    emailChanged,
    isStudent,
    isUnder16EmailLocked,
    handleUpdateProfile,
  };
}
