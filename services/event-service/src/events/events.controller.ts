import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { OptionalJwtAuthGuard } from "../common/optional-jwt-auth.guard";
import { OptionalCurrentUser } from "../common/optional-current-user.decorator";
import { CreateEventDto } from "./dto/create-event.dto";
import { ListEventsQuery } from "./dto/list-events.query";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateEventStatusDto } from "./dto/update-event-status.dto";
import { EventsService } from "./events.service";

const EVENT_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...EVENT_MANAGER_ROLES)
  create(@Body() dto: CreateEventDto, @CurrentUser() caller: JwtAccessPayload) {
    return this.eventsService.create(dto, caller);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query() query: ListEventsQuery,
    @OptionalCurrentUser() caller?: JwtAccessPayload,
  ) {
    return this.eventsService.findAll(
      query.page ?? 1,
      query.pageSize ?? 20,
      query.restaurantId,
      caller,
    );
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param("id") id: string,
    @OptionalCurrentUser() caller?: JwtAccessPayload,
  ) {
    return this.eventsService.findVisibleOrThrow(id, caller);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...EVENT_MANAGER_ROLES)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.eventsService.update(id, dto, caller);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...EVENT_MANAGER_ROLES)
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateEventStatusDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.eventsService.updateStatus(id, dto, caller);
  }
}
