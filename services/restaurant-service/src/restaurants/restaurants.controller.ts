import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { OptionalJwtAuthGuard } from "../common/optional-jwt-auth.guard";
import { OptionalCurrentUser } from "../common/optional-current-user.decorator";
import { canManageRestaurant } from "../common/auth-helpers";
import { CreateRestaurantDto } from "./dto/create-restaurant.dto";
import { ListRestaurantsQuery } from "./dto/list-restaurants.query";
import { UpdateRestaurantDto } from "./dto/update-restaurant.dto";
import { UpdateRestaurantStatusDto } from "./dto/update-restaurant-status.dto";
import { RestaurantsService } from "./restaurants.service";

@Controller("restaurants")
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateRestaurantDto) {
    return this.restaurantsService.create(dto);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(
    @Query() query: ListRestaurantsQuery,
    @OptionalCurrentUser() caller?: JwtAccessPayload,
  ) {
    return this.restaurantsService.findAll(
      query.page ?? 1,
      query.pageSize ?? 20,
      caller,
    );
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param("id") id: string,
    @OptionalCurrentUser() caller?: JwtAccessPayload,
  ) {
    return this.restaurantsService.findVisibleOrThrow(id, caller);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateRestaurantStatusDto,
  ) {
    return this.restaurantsService.updateStatus(id, dto);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.RESTAURANT_OWNER)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRestaurantDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    if (!canManageRestaurant(caller, id)) {
      throw new ForbiddenException(
        "You may only update your own restaurant",
      );
    }
    return this.restaurantsService.update(id, dto, caller);
  }
}
