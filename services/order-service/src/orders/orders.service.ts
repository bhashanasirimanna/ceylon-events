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
  EventStatus,
  OrderStatus,
  SeatStatus,
  type JwtAccessPayload,
  type PaginatedResult,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canAccessOrder } from "../common/auth-helpers";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderItem } from "./entities/order-item.entity";
import { Order } from "./entities/order.entity";
import type {
  UpstreamAvailability,
  UpstreamEvent,
  UpstreamSeatMapSnapshot,
  UpstreamTicketTier,
} from "./upstream-types";

const HTTP_TIMEOUT_MS = 5000;

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

@Injectable()
export class OrdersService {
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly venueServiceUrl = process.env.VENUE_SERVICE_URL;

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    private readonly httpService: HttpService,
  ) {}

  // ---------------------------------------------------------------------
  // Upstream fetch helpers
  // ---------------------------------------------------------------------

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
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          throw new NotFoundException("Event not found");
        }
        throw new BadGatewayException("Event service returned an error");
      }
      throw new BadGatewayException("Event service is unavailable");
    }
  }

  private async fetchTicketTier(
    ticketTierId: string,
  ): Promise<UpstreamTicketTier> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamTicketTier>(
          `${this.eventServiceUrl}/ticket-tiers/${ticketTierId}`,
          { timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          throw new NotFoundException(
            `Ticket tier ${ticketTierId} not found`,
          );
        }
        throw new BadGatewayException("Event service returned an error");
      }
      throw new BadGatewayException("Event service is unavailable");
    }
  }

  private async fetchAvailability(
    seatMapVersionId: string,
    holderToken: string,
  ): Promise<UpstreamAvailability> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamAvailability>(
          `${this.venueServiceUrl}/seat-map-versions/${seatMapVersionId}/availability`,
          { params: { holderToken }, timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch {
      throw new BadGatewayException("Venue service is unavailable");
    }
  }

  private async fetchSnapshot(
    seatMapVersionId: string,
  ): Promise<UpstreamSeatMapSnapshot> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamSeatMapSnapshot>(
          `${this.venueServiceUrl}/seat-map-versions/${seatMapVersionId}`,
          { timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException("Seat map version not found");
      }
      throw new BadGatewayException("Venue service is unavailable");
    }
  }

  private findSeatInSnapshot(
    snapshot: UpstreamSeatMapSnapshot,
    seatId: string,
  ): { seatLabel: string; sectionId: string | null } | null {
    for (const table of snapshot.tables) {
      const seat = table.seats.find((s) => s.id === seatId);
      if (seat) {
        return { seatLabel: seat.seatLabel, sectionId: table.sectionId };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Order creation
  // ---------------------------------------------------------------------

  /**
   * Deliberately does NOT call venue-service's mark-sold endpoint. This
   * order only records the buyer's intent to pay — real payment collection
   * and confirmation is the future Payment Service's job (Phase 4). Seats
   * stay protected purely by their Redis hold-lock (see venue-service)
   * until then; marking a seat permanently sold happens only once a
   * payment actually confirms.
   */
  async create(
    dto: CreateOrderDto,
    caller: JwtAccessPayload,
  ): Promise<OrderWithItems> {
    const event = await this.fetchEvent(dto.eventId);
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException(
        "This event is not open for ticket sales",
      );
    }

    let snapshot: UpstreamSeatMapSnapshot | null = null;
    const now = Date.now();
    const pendingCountByTier = new Map<string, number>();

    const preparedItems: Array<{
      ticketTierId: string;
      seatId: string | null;
      seatLabel: string | null;
      priceMinorUnits: number;
    }> = [];
    let currency = "LKR";

    for (const itemInput of dto.items) {
      const tier = await this.fetchTicketTier(itemInput.ticketTierId);
      if (tier.eventId !== dto.eventId) {
        throw new BadRequestException(
          `Ticket tier ${tier.id} does not belong to this event`,
        );
      }
      if (tier.saleStartAt && new Date(tier.saleStartAt).getTime() > now) {
        throw new BadRequestException(
          "Ticket sales are not currently open",
        );
      }
      if (tier.saleEndAt && new Date(tier.saleEndAt).getTime() < now) {
        throw new BadRequestException(
          "Ticket sales are not currently open",
        );
      }

      const seatId = itemInput.seatId ?? null;
      let seatLabel: string | null = null;

      if (seatId) {
        if (!itemInput.holderToken) {
          throw new BadRequestException(
            "holderToken is required when selecting a seat",
          );
        }
        if (!event.seatMapVersionId) {
          throw new BadRequestException(
            "This event has no seat map to select a seat from",
          );
        }

        const availability = await this.fetchAvailability(
          event.seatMapVersionId,
          itemInput.holderToken,
        );
        if (availability[seatId] !== SeatStatus.HELD_BY_ME) {
          throw new ConflictException("You no longer hold this seat");
        }

        if (!snapshot) {
          snapshot = await this.fetchSnapshot(event.seatMapVersionId);
        }
        const seatInfo = this.findSeatInSnapshot(snapshot, seatId);
        seatLabel = seatInfo?.seatLabel ?? null;

        if (
          tier.allowedSectionIds &&
          tier.allowedSectionIds.length > 0 &&
          seatInfo &&
          (!seatInfo.sectionId ||
            !tier.allowedSectionIds.includes(seatInfo.sectionId))
        ) {
          throw new BadRequestException(
            "This seat is not part of a section this ticket tier allows",
          );
        }
      } else if (tier.quantityLimit !== null) {
        // Best-effort check only — not perfectly race-safe under concurrent
        // requests for the same general-admission tier. Accepted limitation
        // for this phase; a real reservation/lock (like the seat holds
        // above) would be needed to close that gap.
        const alreadySold = await this.countSoldItemsForTier(tier.id);
        const pendingInThisOrder = pendingCountByTier.get(tier.id) ?? 0;
        if (alreadySold + pendingInThisOrder + 1 > tier.quantityLimit) {
          throw new ConflictException(`Ticket tier "${tier.name}" is sold out`);
        }
        pendingCountByTier.set(tier.id, pendingInThisOrder + 1);
      }

      preparedItems.push({
        ticketTierId: tier.id,
        seatId,
        seatLabel,
        priceMinorUnits: tier.priceMinorUnits,
      });
      currency = tier.currency;
    }

    const totalMinorUnits = preparedItems.reduce(
      (sum, item) => sum + item.priceMinorUnits,
      0,
    );

    const order = await this.ordersRepository.save(
      this.ordersRepository.create({
        buyerId: caller.sub,
        eventId: dto.eventId,
        status: OrderStatus.PENDING,
        totalMinorUnits,
        currency,
        paymentMethod: dto.paymentMethod,
      }),
    );

    const savedItems = await this.orderItemsRepository.save(
      preparedItems.map((item) =>
        this.orderItemsRepository.create({
          orderId: order.id,
          ...item,
        }),
      ),
    );

    return { ...order, items: savedItems };
  }

  private async countSoldItemsForTier(ticketTierId: string): Promise<number> {
    return this.orderItemsRepository
      .createQueryBuilder("item")
      .innerJoin("orders", "o", "o.id = item.order_id")
      .where("item.ticket_tier_id = :ticketTierId", { ticketTierId })
      .andWhere("o.status != :cancelled", {
        cancelled: OrderStatus.CANCELLED,
      })
      .getCount();
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  private async withItems(order: Order): Promise<OrderWithItems> {
    const items = await this.orderItemsRepository.find({
      where: { orderId: order.id },
    });
    return { ...order, items };
  }

  async findMine(buyerId: string): Promise<OrderWithItems[]> {
    const orders = await this.ordersRepository.find({
      where: { buyerId },
      order: { createdAt: "DESC" },
    });
    return Promise.all(orders.map((order) => this.withItems(order)));
  }

  async findOneOrThrow(
    id: string,
    caller: JwtAccessPayload,
  ): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (!canAccessOrder(caller, order)) {
      throw new ForbiddenException("You may not view this order");
    }
    return this.withItems(order);
  }

  async findAll(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<OrderWithItems>> {
    const [orders, total] = await this.ordersRepository.findAndCount({
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    const items = await Promise.all(
      orders.map((order) => this.withItems(order)),
    );
    return { items, total, page, pageSize };
  }

  async cancel(
    id: string,
    caller: JwtAccessPayload,
  ): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (!canAccessOrder(caller, order)) {
      throw new ForbiddenException("You may not cancel this order");
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("Only pending orders can be cancelled");
    }
    order.status = OrderStatus.CANCELLED;
    await this.ordersRepository.save(order);
    return this.withItems(order);
  }
}
