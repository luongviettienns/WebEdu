import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { hasRequiredRole } from '../auth/role-hierarchy.util.js';
import {
  AUTHENTICATED_ONLY_KEY,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const cls = context.getClass();

    const handlerPublic = this.reflector.get<boolean | undefined>(IS_PUBLIC_KEY, handler);
    const handlerRoles = this.reflector.get<Role[] | undefined>(ROLES_KEY, handler);
    const handlerAuthOnly = this.reflector.get<boolean | undefined>(
      AUTHENTICATED_ONLY_KEY,
      handler,
    );

    if (handlerPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    // Handler-level metadata always takes precedence over class-level defaults.
    if (handlerRoles && handlerRoles.length > 0) {
      if (!user || !hasRequiredRole(user.roles, handlerRoles)) {
        throw new ForbiddenException('Bạn không có quyền truy cập');
      }
      return true;
    }

    if (handlerAuthOnly) {
      if (!user) {
        throw new ForbiddenException('Bạn không có quyền truy cập');
      }
      return true;
    }

    const classPublic = this.reflector.get<boolean | undefined>(IS_PUBLIC_KEY, cls);
    if (classPublic) {
      return true;
    }

    const classRoles = this.reflector.get<Role[] | undefined>(ROLES_KEY, cls);
    if (classRoles && classRoles.length > 0) {
      if (!user || !hasRequiredRole(user.roles, classRoles)) {
        throw new ForbiddenException('Bạn không có quyền truy cập');
      }
      return true;
    }

    const classAuthOnly = this.reflector.get<boolean | undefined>(AUTHENTICATED_ONLY_KEY, cls);
    if (classAuthOnly) {
      if (!user) {
        throw new ForbiddenException('Bạn không có quyền truy cập');
      }
      return true;
    }

    // Default-deny: endpoints without @Public(), @AuthenticatedOnly(), or @Roles(...) are denied.
    throw new ForbiddenException('Bạn không có quyền truy cập');
  }
}
