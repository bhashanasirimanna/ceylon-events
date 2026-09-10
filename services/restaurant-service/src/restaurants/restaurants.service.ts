import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  RestaurantStatus,
  type JwtAccessPayload,
  type PaginatedResult,
} from "@ceylon/shared-types";
import { canManageRestaurant, isPlatformAdmin } from "../common/auth-helpers";
import { CreateRestaurantDto } from "./dto/create-restaurant.dto";
import { UpdateRestaurantDto } from "./dto/update-restaurant.dto";
import { UpdateRestaurantStatusDto } from "./dto/update-restaurant-status.dto";
import { Restaurant } from "./entities/restaurant.entity";

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantsRepository: Repository<Restaurant>,
  ) {}

  async create(dto: CreateRestaurantDto): Promise<Restaurant> {
    const restaurant = this.restaurantsRepository.create({
      ...dto,
      status: RestaurantStatus.PENDING,
    });
    return this.restaurantsRepository.save(restaurant);
  }

  async findAll(
    page: number,
    pageSize: number,
    caller?: JwtAccessPayload,
  ): Promise<PaginatedResult<Restaurant>> {
    const where = isPlatformAdmin(caller)
      ? {}
      : { status: RestaurantStatus.APPROVED };

    const [items, total] = await this.restaurantsRepository.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: "DESC" },
    });

    return { items, total, page, pageSize };
  }

  /** Fetches a restaurant, hiding non-approved ones from non-privileged callers. */
  async findVisibleOrThrow(
    id: string,
    caller?: JwtAccessPayload,
  ): Promise<Restaurant> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: { id },
    });
    if (!restaurant) {
      throw new NotFoundException("Restaurant not found");
    }
    if (
      restaurant.status !== RestaurantStatus.APPROVED &&
      !canManageRestaurant(caller, id)
    ) {
      throw new NotFoundException("Restaurant not found");
    }
    return restaurant;
  }

  async findByIdOrThrow(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantsRepository.findOne({
      where: { id },
    });
    if (!restaurant) {
      throw new NotFoundException("Restaurant not found");
    }
    return restaurant;
  }

  async updateStatus(
    id: string,
    dto: UpdateRestaurantStatusDto,
  ): Promise<Restaurant> {
    const restaurant = await this.findByIdOrThrow(id);
    restaurant.status = dto.status;
    return this.restaurantsRepository.save(restaurant);
  }

  async update(
    id: string,
    dto: UpdateRestaurantDto,
    caller: JwtAccessPayload,
  ): Promise<Restaurant> {
    if (!canManageRestaurant(caller, id)) {
      throw new ForbiddenException(
        "You may only update your own restaurant",
      );
    }
    const restaurant = await this.findByIdOrThrow(id);
    Object.assign(restaurant, dto);
    return this.restaurantsRepository.save(restaurant);
  }

  /** Used by MenuService to validate a restaurant exists + check visibility. */
  async assertVisible(
    id: string,
    caller?: JwtAccessPayload,
  ): Promise<Restaurant> {
    return this.findVisibleOrThrow(id, caller);
  }
}
