import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { JwtAccessPayload } from "@ceylon/shared-types";
import { canManageRestaurant } from "../common/auth-helpers";
import { RestaurantsService } from "../restaurants/restaurants.service";
import { CreateMenuCategoryDto } from "./dto/create-menu-category.dto";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto";
import { MenuCategory } from "./entities/menu-category.entity";
import { MenuItem } from "./entities/menu-item.entity";

export interface MenuCategoryWithItems extends MenuCategory {
  items: MenuItem[];
}

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoriesRepository: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private readonly itemsRepository: Repository<MenuItem>,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async createCategory(
    restaurantId: string,
    dto: CreateMenuCategoryDto,
    caller: JwtAccessPayload,
  ): Promise<MenuCategory> {
    this.assertCanManage(restaurantId, caller);
    await this.restaurantsService.findByIdOrThrow(restaurantId);
    const category = this.categoriesRepository.create({
      restaurantId,
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.categoriesRepository.save(category);
  }

  async createItem(
    restaurantId: string,
    dto: CreateMenuItemDto,
    caller: JwtAccessPayload,
  ): Promise<MenuItem> {
    this.assertCanManage(restaurantId, caller);
    const category = await this.categoriesRepository.findOne({
      where: { id: dto.categoryId, restaurantId },
    });
    if (!category) {
      throw new NotFoundException(
        "Menu category not found for this restaurant",
      );
    }
    const item = this.itemsRepository.create({
      restaurantId,
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description ?? null,
      priceMinorUnits: dto.priceMinorUnits,
      currency: dto.currency ?? "LKR",
      dietaryTags: dto.dietaryTags ?? [],
      isAvailable: dto.isAvailable ?? true,
      photoUrls: dto.photoUrls ?? [],
    });
    return this.itemsRepository.save(item);
  }

  async updateItem(
    itemId: string,
    dto: UpdateMenuItemDto,
    caller: JwtAccessPayload,
  ): Promise<MenuItem> {
    const item = await this.findItemOrThrow(itemId);
    this.assertCanManage(item.restaurantId, caller);
    Object.assign(item, dto);
    return this.itemsRepository.save(item);
  }

  async deleteItem(itemId: string, caller: JwtAccessPayload): Promise<void> {
    const item = await this.findItemOrThrow(itemId);
    this.assertCanManage(item.restaurantId, caller);
    await this.itemsRepository.remove(item);
  }

  async getMenu(
    restaurantId: string,
    caller?: JwtAccessPayload,
  ): Promise<MenuCategoryWithItems[]> {
    await this.restaurantsService.assertVisible(restaurantId, caller);
    const canManage = canManageRestaurant(caller, restaurantId);

    const categories = await this.categoriesRepository.find({
      where: { restaurantId },
      order: { sortOrder: "ASC" },
    });
    const items = await this.itemsRepository.find({
      where: { restaurantId },
    });

    return categories.map((category) => ({
      ...category,
      items: items.filter(
        (item) =>
          item.categoryId === category.id && (canManage || item.isAvailable),
      ),
    }));
  }

  private async findItemOrThrow(itemId: string): Promise<MenuItem> {
    const item = await this.itemsRepository.findOne({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException("Menu item not found");
    }
    return item;
  }

  private assertCanManage(
    restaurantId: string,
    caller: JwtAccessPayload,
  ): void {
    if (!canManageRestaurant(caller, restaurantId)) {
      throw new ForbiddenException(
        "You may only manage the menu of your own restaurant",
      );
    }
  }
}
