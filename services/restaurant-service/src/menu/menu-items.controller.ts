import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from "@ceylon/nest-common";
import { UserRole, type JwtAccessPayload } from "@ceylon/shared-types";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto";
import { MenuService } from "./menu.service";

@Controller("menu-items")
export class MenuItemsController {
  constructor(private readonly menuService: MenuService) {}

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.RESTAURANT_OWNER,
    UserRole.RESTAURANT_STAFF,
  )
  update(
    @Param("id") id: string,
    @Body() dto: UpdateMenuItemDto,
    @CurrentUser() caller: JwtAccessPayload,
  ) {
    return this.menuService.updateItem(id, dto, caller);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.RESTAURANT_OWNER,
    UserRole.RESTAURANT_STAFF,
  )
  remove(@Param("id") id: string, @CurrentUser() caller: JwtAccessPayload) {
    return this.menuService.deleteItem(id, caller);
  }
}
