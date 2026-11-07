'use client';

import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { PortalGuardStatus } from '@/features/auth/components/AccessDeniedState';
import {
  AuthUserDto,
  getCurrentUser,
} from '@/features/auth/api/auth.api';
import { userHasAnyRole } from '@/features/auth/roles';
import {
  getMyProfile,
  UserProfileDto,
} from '@/features/profile/api/profile.api';
import {
  extractErrorMessage,
  isForbiddenError,
  isUnauthorizedError,
  purgeLegacyWebStorageTokens,
  type RequestOptions,
} from '@/lib/api-client';
import type { Role } from '@/types/user';

export interface PortalSessionState<TUser extends AuthUserDto> {
  status: PortalGuardStatus;
  user: TUser | null;
  errorMessage: string;
  setUser: React.Dispatch<React.SetStateAction<TUser | null>>;
  handleApiAuthError: (error: unknown) => boolean;
}

function usePortalSessionBase<TUser extends AuthUserDto>(
  fetchSessionUser: (options?: RequestOptions) => Promise<TUser>,
  allowedRoles?: readonly Role[],
): PortalSessionState<TUser> {
  const router = useRouter();
  const [status, setStatus] = useState<PortalGuardStatus>('checking');
  const [user, setUser] = useState<TUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleApiAuthError = useCallback(
    (error: unknown): boolean => {
      if (isUnauthorizedError(error)) {
        purgeLegacyWebStorageTokens();
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
    const controller = new AbortController();

    void (async () => {
      try {
        const current = await fetchSessionUser({ signal: controller.signal });
        if (controller.signal.aborted) return;

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
        if (controller.signal.aborted) return;

        if (handleApiAuthError(error)) {
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
      controller.abort();
    };
  }, [fetchSessionUser, allowedRoles, handleApiAuthError]);


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
