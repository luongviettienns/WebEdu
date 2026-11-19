import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';
/** Marks a route as accessible to any authenticated user regardless of role. */
export const AuthenticatedOnly = () => SetMetadata(AUTHENTICATED_ONLY_KEY, true);

export const SKIP_ACTIVITY_TOUCH_KEY = 'skipActivityTouch';
/** Marks a passive polling route so SessionValidator checks idle timeout without refreshing lastActivityAt. */
export const SkipActivityTouch = () => SetMetadata(SKIP_ACTIVITY_TOUCH_KEY, true);
