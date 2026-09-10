import type { UserRole, RestaurantStatus } from "@ceylon/shared-types";

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  restaurantId: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  address: string;
  contactEmail: string;
  contactPhone: string | null;
  coverPhotoUrl: string | null;
  status: RestaurantStatus;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
