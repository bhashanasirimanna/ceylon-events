import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventStatus, type JwtAccessPayload } from "@ceylon/shared-types";
import type { PaginatedResult } from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant, isPlatformAdmin } from "../common/auth-helpers";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateEventStatusDto } from "./dto/update-event-status.dto";
import { Event } from "./entities/event.entity";

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  async create(
    dto: CreateEventDto,
    caller: JwtAccessPayload,
  ): Promise<Event> {
    if (!canManageRestaurant(caller, dto.restaurantId)) {
      throw new ForbiddenException(
        "You may only create events for your own restaurant",
      );
    }
    const event = this.eventsRepository.create({
      restaurantId: dto.restaurantId,
      seatMapVersionId: dto.seatMapVersionId ?? null,
      title: dto.title,
      description: dto.description ?? null,
      bannerImageUrl: dto.bannerImageUrl ?? null,
      startsAt: new Date(dto.startsAt),
    });
    return this.eventsRepository.save(event);
  }

  async findAll(
    page: number,
    pageSize: number,
    restaurantId: string | undefined,
    caller: JwtAccessPayload | undefined,
  ): Promise<PaginatedResult<Event>> {
    const qb = this.eventsRepository.createQueryBuilder("event");
    if (restaurantId) {
      qb.andWhere("event.restaurant_id = :restaurantId", { restaurantId });
    }

    if (isPlatformAdmin(caller)) {
      // sees everything
    } else if (caller?.restaurantId) {
      qb.andWhere(
        "(event.status = :published OR event.restaurant_id = :ownRestaurantId)",
        { published: EventStatus.PUBLISHED, ownRestaurantId: caller.restaurantId },
      );
    } else {
      qb.andWhere("event.status = :published", {
        published: EventStatus.PUBLISHED,
      });
    }

    qb.orderBy("event.starts_at", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  private async getOrThrow(id: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    return event;
  }

  async findVisibleOrThrow(
    id: string,
    caller: JwtAccessPayload | undefined,
  ): Promise<Event> {
    const event = await this.getOrThrow(id);
    if (
      event.status !== EventStatus.PUBLISHED &&
      !canManageRestaurant(caller, event.restaurantId)
    ) {
      throw new NotFoundException("Event not found");
    }
    return event;
  }

  /** Internal lookup with no visibility filtering, for other services. */
  async findByIdOrThrow(id: string): Promise<Event> {
    return this.getOrThrow(id);
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    caller: JwtAccessPayload,
  ): Promise<Event> {
    const event = await this.getOrThrow(id);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException("You may only update your own events");
    }
    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.bannerImageUrl !== undefined)
      event.bannerImageUrl = dto.bannerImageUrl;
    if (dto.seatMapVersionId !== undefined)
      event.seatMapVersionId = dto.seatMapVersionId;
    if (dto.startsAt !== undefined) event.startsAt = new Date(dto.startsAt);
    return this.eventsRepository.save(event);
  }

  async updateStatus(
    id: string,
    dto: UpdateEventStatusDto,
    caller: JwtAccessPayload,
  ): Promise<Event> {
    const event = await this.getOrThrow(id);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException("You may only update your own events");
    }
    event.status = dto.status;
    return this.eventsRepository.save(event);
  }
}
