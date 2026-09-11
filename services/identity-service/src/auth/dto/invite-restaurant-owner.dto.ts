import { IsEmail, IsString, IsUUID, MinLength } from "class-validator";

// Mirrors InviteStaffDto in shape, but role is implicitly
// RESTAURANT_OWNER — this endpoint is specifically for the invite sent
// out when a platform admin creates a new restaurant, not general staff
// invites (see auth.controller.ts's invite-restaurant-staff for that).
export class InviteRestaurantOwnerDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsUUID()
  restaurantId: string;
}
