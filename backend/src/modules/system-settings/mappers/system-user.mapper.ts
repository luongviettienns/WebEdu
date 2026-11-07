import type { Role, UserStatus } from '@prisma/client';
import { getHighestRole } from '../../../common/auth/role-hierarchy.util.js';

export interface SystemUserItemDto {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  effectiveRole: Role;
  status: UserStatus;
  createdAt: string;
}

export function toSystemUserDto(user: {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
  createdAt: Date;
}): SystemUserItemDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    roles: user.roles,
    effectiveRole: getHighestRole(user.roles),
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
