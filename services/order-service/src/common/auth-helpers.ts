import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import type { Order } from "../orders/entities/order.entity";

export function isPlatformAdmin(user?: JwtAccessPayload | null): boolean {
  if (!user) return false;
  return user.roles.some(
    (role) => role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN,
  );
}

export function canAccessOrder(
  user: JwtAccessPayload,
  order: Order,
): boolean {
  if (isPlatformAdmin(user)) return true;
  return user.sub === order.buyerId;
}
