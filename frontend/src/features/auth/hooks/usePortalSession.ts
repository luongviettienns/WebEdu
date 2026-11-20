'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { PortalGuardStatus } from '@/features/auth/components/AccessDeniedState';
import {
  AuthUserDto,
  getActiveLogoutRedirect,
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

export const PORTAL_PROFILE_UPDATED_EVENT = 'webedu:portal-profile-updated';

export type PortalProfilePatch = Partial<Pick<AuthUserDto, 'fullName' | 'email' | 'phone'>>;

export function notifyPortalProfileUpdated(patch: PortalProfilePatch): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PortalProfilePatch>(PORTAL_PROFILE_UPDATED_EVENT, { detail: patch }));
  }
}

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
        if (!getActiveLogoutRedirect()) {
          router.replace('/login');
        }
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

    const recheckSession = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      try {
        const fresh = await fetchSessionUser();
        setUser((prev) => {
          if (!prev) return fresh;
          const rolesOrAccessChanged =
            prev.id !== fresh.id ||
            prev.status !== fresh.status ||
            JSON.stringify(prev.roles) !== JSON.stringify(fresh.roles);
          if (rolesOrAccessChanged) {
            if (
              allowedRoles &&
              allowedRoles.length > 0 &&
              !userHasAnyRole(fresh, allowedRoles)
            ) {
              setStatus('forbidden');
            } else {
              setStatus('authorized');
            }
            return fresh;
          }
          if (
            prev.fullName !== fresh.fullName ||
            prev.email !== fresh.email ||
            prev.phone !== fresh.phone
          ) {
            return fresh;
          }
          return prev;
        });
      } catch (err) {
        handleApiAuthError(err);
      }
    };

    const handleProfileUpdated = (event: Event) => {
      const patch = (event as CustomEvent<PortalProfilePatch>).detail;
      if (!patch) return;
      setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    window.addEventListener('focus', recheckSession);
    document.addEventListener('visibilitychange', recheckSession);
    window.addEventListener(PORTAL_PROFILE_UPDATED_EVENT, handleProfileUpdated);

    return () => {
      controller.abort();
      window.removeEventListener('focus', recheckSession);
      document.removeEventListener('visibilitychange', recheckSession);
      window.removeEventListener(PORTAL_PROFILE_UPDATED_EVENT, handleProfileUpdated);
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

export function usePortalIdentity(): PortalSessionState<AuthUserDto> {
  const fetchSessionUser = useCallback(
    (options?: RequestOptions) => getCurrentUser(options),
    [],
  );
  return usePortalSessionBase(fetchSessionUser);
}

export const PortalSessionContext = createContext<PortalSessionState<AuthUserDto> | null>(null);

export function usePortalSession(allowedRoles?: readonly Role[]): PortalSessionState<AuthUserDto> {
  const session = useContext(PortalSessionContext);
  const [deniedUser, setDeniedUser] = useState<AuthUserDto | null>(null);
  const { user, handleApiAuthError: handleSessionError } = session ?? {};
  const handleApiAuthError = useCallback((error: unknown) => {
    if (!handleSessionError) return false;
    if (isForbiddenError(error)) {
      setDeniedUser(user ?? null);
      return true;
    }
    return handleSessionError(error);
  }, [handleSessionError, user]);

  if (!session) throw new Error('Portal session provider is missing');
  const forbidden = session.user && (
    deniedUser === session.user ||
    (allowedRoles?.length && !userHasAnyRole(session.user, allowedRoles))
  );
  return {
    ...session,
    status: session.status === 'authorized' && forbidden ? 'forbidden' : session.status,
    handleApiAuthError,
  };
}

export function useProfileSession(
  allowedRoles?: readonly Role[],
): PortalSessionState<UserProfileDto> {
  const fetchSessionUser = useCallback(
    (options?: RequestOptions) => getMyProfile(options),
    [],
  );
  return usePortalSessionBase(fetchSessionUser, allowedRoles);
}

export const usePortalProfileSession = useProfileSession;
