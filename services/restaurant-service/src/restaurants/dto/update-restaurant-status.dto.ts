import { IsEnum } from "class-validator";
import { RestaurantStatus } from "@ceylon/shared-types";

export class UpdateRestaurantStatusDto {
  @IsEnum(RestaurantStatus)
  status: RestaurantStatus;
}
