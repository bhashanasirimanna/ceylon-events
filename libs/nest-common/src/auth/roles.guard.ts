import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { JwtAccessPayload, UserRole } from "@ceylon/shared-types";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: JwtAccessPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException("Missing authenticated user");
    }

    const hasRole = user.roles?.some((role) => requiredRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException("Insufficient role for this operation");
    }
    return true;
  }
}
