import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";

export function isPlatformAdmin(user?: JwtAccessPayload | null): boolean {
  if (!user) return false;
  return user.roles.some(
    (role) => role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN,
  );
}
