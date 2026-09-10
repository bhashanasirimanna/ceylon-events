import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RestaurantsModule } from "../restaurants/restaurants.module";
import { MenuCategory } from "./entities/menu-category.entity";
import { MenuItem } from "./entities/menu-item.entity";
import { MenuItemsController } from "./menu-items.controller";
import { MenuService } from "./menu.service";
import { RestaurantMenuController } from "./restaurant-menu.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuCategory, MenuItem]),
    RestaurantsModule,
  ],
  controllers: [RestaurantMenuController, MenuItemsController],
  providers: [MenuService],
})
export class MenuModule {}
