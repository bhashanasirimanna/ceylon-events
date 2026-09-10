import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";

export function isPlatformAdmin(user?: JwtAccessPayload | null): boolean {
  if (!user) return false;
  return user.roles.some(
    (role) => role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN,
  );
}

export function canManageRestaurant(
  user: JwtAccessPayload | undefined,
  restaurantId: string,
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return user.restaurantId === restaurantId;
}
