import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom } from "rxjs";
import { isAxiosError } from "axios";
import {
  OrderStatus,
  RatingSubjectType,
  type JwtAccessPayload,
  type PaginatedResult,
  type RatingSnapshot,
  type RatingSummary,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant } from "../common/auth-helpers";
import { CreateRatingDto } from "./dto/create-rating.dto";
import { Rating } from "./entities/rating.entity";
import type {
  UpstreamEvent,
  UpstreamFoodPreOrder,
  UpstreamOrder,
} from "./upstream-types";

const HTTP_TIMEOUT_MS = 5000;
const UNIQUE_VIOLATION = "23505";

@Injectable()
export class RatingsService {
  private readonly orderServiceUrl = process.env.ORDER_SERVICE_URL;
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly foodOrderServiceUrl = process.env.FOOD_ORDER_SERVICE_URL;

  constructor(
    @InjectRepository(Rating)
    private readonly ratingsRepository: Repository<Rating>,
    private readonly httpService: HttpService,
  ) {}

  // ---------------------------------------------------------------------
  // Upstream helpers
  // ---------------------------------------------------------------------

  private async fetchOrderAsCaller(
    orderId: string,
    authorizationHeader: string,
  ): Promise<UpstreamOrder> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamOrder>(
          `${this.orderServiceUrl}/orders/${orderId}`,
          {
            headers: { Authorization: authorizationHeader },
            timeout: HTTP_TIMEOUT_MS,
          },
        ),
      );
      return res.data;
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          throw new NotFoundException("Order not found");
        }
        if (error.response.status === 403) {
          throw new ForbiddenException("You may not rate this order");
        }
        throw new BadGatewayException("Order service returned an error");
      }
      throw new BadGatewayException("Order service is unavailable");
    }
  }

  private async fetchEvent(eventId: string): Promise<UpstreamEvent> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamEvent>(
          `${this.eventServiceUrl}/events/${eventId}`,
          { timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException("Event not found");
      }
      throw new BadGatewayException("Event service is unavailable");
    }
  }

  private async fetchFoodPreOrderForItem(
    orderItemId: string,
    authorizationHeader: string,
  ): Promise<UpstreamFoodPreOrder | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamFoodPreOrder | null>(
          `${this.foodOrderServiceUrl}/food-pre-orders/by-order-item/${orderItemId}`,
          {
            headers: { Authorization: authorizationHeader },
            timeout: HTTP_TIMEOUT_MS,
          },
        ),
      );
      // A missing food pre-order comes back as an empty body (Nest/Express
      // send `null` as a zero-length response, not the JSON text "null"),
      // which axios parses as "" rather than null — normalize that here so
      // callers can rely on a real null/object distinction.
      return res.data && typeof res.data === "object" ? res.data : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // Snapshot helper
  // ---------------------------------------------------------------------

  private toSnapshot(rating: Rating): RatingSnapshot {
    return {
      id: rating.id,
      buyerId: rating.buyerId,
      orderId: rating.orderId,
      eventId: rating.eventId,
      restaurantId: rating.restaurantId,
      subjectType: rating.subjectType,
      subjectId: rating.subjectId,
      stars: rating.stars,
      comment: rating.comment,
      createdAt: rating.createdAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------

  async create(
    dto: CreateRatingDto,
    caller: JwtAccessPayload,
    authorizationHeader: string,
  ): Promise<RatingSnapshot> {
    const order = await this.fetchOrderAsCaller(dto.orderId, authorizationHeader);
    if (order.buyerId !== caller.sub) {
      throw new ForbiddenException("You may only rate your own orders");
    }
    if (order.eventId !== dto.eventId) {
      throw new BadRequestException("This order does not belong to that event");
    }
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException("Only confirmed orders can be rated");
    }

    const event = await this.fetchEvent(dto.eventId);
    if (new Date(event.startsAt).getTime() > Date.now()) {
      throw new BadRequestException(
        "You can only rate an event after it has started",
      );
    }

    if (dto.subjectType === RatingSubjectType.EVENT) {
      if (dto.subjectId !== dto.eventId) {
        throw new BadRequestException(
          "subjectId must be the eventId when rating an event",
        );
      }
    } else {
      // MENU_ITEM — verify the buyer actually pre-ordered this dish
      // somewhere on this order, checking every ticket/item on it.
      let ordered = false;
      for (const item of order.items) {
        const foodPreOrder = await this.fetchFoodPreOrderForItem(
          item.id,
          authorizationHeader,
        );
        if (foodPreOrder?.items.some((i) => i.menuItemId === dto.subjectId)) {
          ordered = true;
          break;
        }
      }
      if (!ordered) {
        throw new BadRequestException(
          "You may only rate a menu item you actually pre-ordered on this order",
        );
      }
    }

    try {
      const rating = await this.ratingsRepository.save(
        this.ratingsRepository.create({
          buyerId: caller.sub,
          orderId: dto.orderId,
          eventId: dto.eventId,
          restaurantId: event.restaurantId,
          subjectType: dto.subjectType,
          subjectId: dto.subjectId,
          stars: dto.stars,
          comment: dto.comment ?? null,
        }),
      );
      return this.toSnapshot(rating);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          "You have already rated this on this order",
        );
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  private assertFilter(
    restaurantId: string | undefined,
    subjectType: RatingSubjectType | undefined,
    subjectId: string | undefined,
  ): void {
    if (!restaurantId && !(subjectType && subjectId)) {
      throw new BadRequestException(
        "Provide either restaurantId, or both subjectType and subjectId",
      );
    }
  }

  async list(
    restaurantId: string | undefined,
    subjectType: RatingSubjectType | undefined,
    subjectId: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<RatingSnapshot>> {
    this.assertFilter(restaurantId, subjectType, subjectId);
    const [items, total] = await this.ratingsRepository.findAndCount({
      where: restaurantId ? { restaurantId } : { subjectType, subjectId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return {
      items: items.map((rating) => this.toSnapshot(rating)),
      total,
      page,
      pageSize,
    };
  }

  async summary(
    restaurantId: string | undefined,
    subjectType: RatingSubjectType | undefined,
    subjectId: string | undefined,
  ): Promise<RatingSummary> {
    this.assertFilter(restaurantId, subjectType, subjectId);
    const qb = this.ratingsRepository.createQueryBuilder("rating");
    if (restaurantId) {
      qb.where("rating.restaurant_id = :restaurantId", { restaurantId });
    } else {
      qb.where("rating.subject_type = :subjectType", { subjectType }).andWhere(
        "rating.subject_id = :subjectId",
        { subjectId },
      );
    }
    const row = await qb
      .select("AVG(rating.stars)", "average")
      .addSelect("COUNT(rating.id)", "count")
      .getRawOne<{ average: string | null; count: string }>();
    const count = Number(row?.count ?? 0);
    return {
      average:
        count > 0 && row?.average
          ? Math.round(Number(row.average) * 10) / 10
          : null,
      count,
    };
  }

  // ---------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------

  async delete(id: string, caller: JwtAccessPayload): Promise<void> {
    const rating = await this.ratingsRepository.findOne({ where: { id } });
    if (!rating) {
      throw new NotFoundException("Rating not found");
    }
    const isAuthor = rating.buyerId === caller.sub;
    if (!isAuthor && !canManageRestaurant(caller, rating.restaurantId)) {
      throw new ForbiddenException("You may not delete this rating");
    }
    await this.ratingsRepository.delete(id);
  }
}
