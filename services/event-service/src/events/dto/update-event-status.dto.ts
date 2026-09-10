import { EventStatus } from "@ceylon/shared-types";
import { IsEnum } from "class-validator";

export class UpdateEventStatusDto {
  @IsEnum(EventStatus)
  status: EventStatus;
}
