import { IsEmail, IsIn, IsString, IsUUID, MinLength } from "class-validator";
import { UserRole } from "@ceylon/shared-types";

export class InviteStaffDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsUUID()
  restaurantId: string;

  @IsIn([UserRole.RESTAURANT_OWNER, UserRole.RESTAURANT_STAFF])
  role: UserRole.RESTAURANT_OWNER | UserRole.RESTAURANT_STAFF;
}
