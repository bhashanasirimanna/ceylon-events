import type { User } from "./entities/user.entity";

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  restaurantId: string | null;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    restaurantId: user.restaurantId,
  };
}
