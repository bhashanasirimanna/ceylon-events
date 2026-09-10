import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { OptionalJwtAuthGuard } from "../common/optional-jwt-auth.guard";
import { OptionalCurrentUser } from "../common/optional-current-user.decorator";
import { CreateMenuCategoryDto } from "./dto/create-menu-category.dto";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import { MenuService } from "./menu.service";

const MENU_MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.RESTAURANT_OWNER,
  UserRole.RESTAURANT_STAFF,
];

@Controller("restaurants/:restaurantId")
export class RestaurantMenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get("menu")
  @UseGuards(OptionalJwtAuthGuard)
  getMenu(
    @Param("restaurantId") restaurantId: string,
    @OptionalCurrentUser() caller?: JwtAccessPayload,
  ) {
    return this.menuService.getMenu(restaurantId, caller);
  }

  @Post("menu-categories")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MENU_MANAGER_ROLES)
  createCategory(
    @Param("restaurantId") restaurantId: string,
    @Body() dto: CreateMenuCategoryDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.menuService.createCategory(restaurantId, dto, caller);
  }

  @Post("menu-items")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MENU_MANAGER_ROLES)
  createItem(
    @Param("restaurantId") restaurantId: string,
    @Body() dto: CreateMenuItemDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.menuService.createItem(restaurantId, dto, caller);
  }
}
