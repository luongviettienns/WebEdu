'use client';

import { useParams } from 'next/navigation';
import React, { Suspense } from 'react';
import { PortalGuardView } from '@/features/auth/components/AccessDeniedState';
import { usePortalSession } from '@/features/auth/hooks/usePortalSession';
import { ClassDetailScreen } from '@/features/classes/components/ClassDetailScreen';
import type { Role } from '@/types/user';

const ALLOWED_ROLES: readonly Role[] = ['TEACHER', 'ADMIN'];

function TeacherClassDetailInner() {
  const params = useParams<{ id: string }>();
  const classId = typeof params?.id === 'string' ? params.id : '';
  const { status, user, errorMessage, handleApiAuthError } = usePortalSession(ALLOWED_ROLES);

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
    <ClassDetailScreen
      classId={classId}
      origin="teacher"
      assignedRoles={user.roles}
      defaultIncludeInactive={false}
      onAuthError={handleApiAuthError}
    />
  );
}

export default function TeacherClassDetailPage() {
  return (
    <Suspense fallback={<PortalGuardView status="checking" currentUser={null} errorMessage="" />}>
      <TeacherClassDetailInner />
    </Suspense>
  );
}
