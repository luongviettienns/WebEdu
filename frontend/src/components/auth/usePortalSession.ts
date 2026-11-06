'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { PortalGuardStatus } from '@/components/auth/AccessDeniedState';
import { setStoredAccessToken } from '@/lib/api-client';
import {
  AuthUserDto,
  extractErrorMessage,
  getCurrentUser,
  getMyProfile,
  isForbiddenError,
  isUnauthorizedError,
  Role,
  userHasAnyRole,
  UserProfileDto,
} from '@/lib/auth-api';

export interface PortalSessionState<TUser extends AuthUserDto> {
  status: PortalGuardStatus;
  user: TUser | null;
  errorMessage: string;
  setUser: React.Dispatch<React.SetStateAction<TUser | null>>;
  handleApiAuthError: (error: unknown) => boolean;
}

function usePortalSessionBase<TUser extends AuthUserDto>(
  fetchSessionUser: () => Promise<TUser>,
  allowedRoles?: readonly Role[],
): PortalSessionState<TUser> {
  const router = useRouter();
  const [status, setStatus] = useState<PortalGuardStatus>('checking');
  const [user, setUser] = useState<TUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleApiAuthError = useCallback(
    (error: unknown): boolean => {
      if (isUnauthorizedError(error)) {
        setStoredAccessToken(null);
        setStatus('unauthorized');
        router.replace('/login');
        return true;
      }
      if (isForbiddenError(error)) {
        setStatus('forbidden');
        return true;
      }
      return false;
    },
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const current = await fetchSessionUser();
        if (cancelled) return;

        setUser(current);
        if (
          allowedRoles &&
          allowedRoles.length > 0 &&
          !userHasAnyRole(current, allowedRoles)
        ) {
          setStatus('forbidden');
          return;
        }

        setStatus('authorized');
      } catch (error) {
        if (cancelled) return;

        if (isUnauthorizedError(error)) {
          setStoredAccessToken(null);
          setStatus('unauthorized');
          router.replace('/login');
          return;
        }

        if (isForbiddenError(error)) {
          setStatus('forbidden');
          return;
        }

        setErrorMessage(
          extractErrorMessage(
            error,
            'Không thể tải thông tin phiên làm việc. Vui lòng thử lại.',
          ),
        );
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchSessionUser, allowedRoles, router]);

  return {
    status,
    user,
    errorMessage,
    setUser,
    handleApiAuthError,
  };
}

export function usePortalSession(
  allowedRoles?: readonly Role[],
): PortalSessionState<AuthUserDto> {
  return usePortalSessionBase(getCurrentUser, allowedRoles);
}

export function usePortalProfileSession(
  allowedRoles?: readonly Role[],
): PortalSessionState<UserProfileDto> {
  return usePortalSessionBase(getMyProfile, allowedRoles);
}
