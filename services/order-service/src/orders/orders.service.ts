import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom } from "rxjs";
import { isAxiosError } from "axios";
import {
  DiscountType,
  EventStatus,
  NotificationType,
  OrderStatus,
  SeatStatus,
  type JwtAccessPayload,
  type PaginatedResult,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canAccessOrder, isPlatformAdmin } from "../common/auth-helpers";
import { PromoCodesService } from "../promo-codes/promo-codes.service";
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
  private readonly logger = new Logger(OrdersService.name);
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly venueServiceUrl = process.env.VENUE_SERVICE_URL;
  private readonly notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL;
  private readonly internalSecret = process.env.INTERNAL_SERVICE_SECRET ?? "";

  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    private readonly httpService: HttpService,
    private readonly promoCodesService: PromoCodesService,
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

  /**
   * The atomic claim step: converts the buyer's short browsing hold into
   * an order-scoped one (see venue-service's HoldsService.reserveForOrder)
   * so the seat survives the whole pending-payment window rather than
   * lapsing back to available a few minutes later. Rejects — same as the
   * availability check above — if another buyer's hold has since taken
   * the seat.
   */
  private async reserveSeatForOrder(
    seatMapVersionId: string,
    seatId: string,
    holderToken: string,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.venueServiceUrl}/seat-map-versions/${seatMapVersionId}/seats/${seatId}/reserve-for-order`,
          { holderToken },
          {
            headers: { "x-internal-secret": this.internalSecret },
            timeout: HTTP_TIMEOUT_MS,
          },
        ),
      );
    } catch (error) {
      if (
        isAxiosError(error) &&
        (error.response?.status === 403 || error.response?.status === 404)
      ) {
        throw new ConflictException("You no longer hold this seat");
      }
      throw new BadGatewayException("Venue service is unavailable");
    }
  }

  /**
   * Frees a seat's hold immediately when a pending order holding it is
   * cancelled. Best-effort/fire-and-forget per seat, same reasoning as
   * this service's other internal calls — a transient venue-service
   * failure here shouldn't block the cancellation itself; the seat's
   * order-scoped hold will simply lapse on its own TTL as a fallback.
   */
  private releaseSeatHold(seatMapVersionId: string, seatId: string): void {
    firstValueFrom(
      this.httpService.post(
        `${this.venueServiceUrl}/seat-map-versions/${seatMapVersionId}/seats/${seatId}/release-for-order`,
        {},
        {
          headers: { "x-internal-secret": this.internalSecret },
          timeout: HTTP_TIMEOUT_MS,
        },
      ),
    ).catch((error) => {
      this.logger.warn(
        `Failed to release seat ${seatId} hold: ${(error as Error).message}`,
      );
    });
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
   * and confirmation is the future Payment Service's job (Phase 4). Every
   * seated item's hold IS atomically extended into an order-scoped
   * reservation here (reserveSeatForOrder), so the seat stays claimed for
   * this order through the whole pending-payment window; marking a seat
   * permanently sold still happens only once a payment actually confirms.
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

      // This event sells seats at physical tables rather than general
      // admission — every ticket must be tied to one, both so two guests
      // can never end up claiming the same table and so food pre-orders
      // downstream have a table to inherit.
      if (!seatId && event.seatMapVersionId) {
        throw new BadRequestException(
          "A table must be selected for this event",
        );
      }

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

        // Atomically claim the seat for this order before it's persisted —
        // the buyer's original browsing hold is short-lived and shouldn't
        // be the only thing standing between here and payment confirmation.
        await this.reserveSeatForOrder(
          event.seatMapVersionId,
          seatId,
          itemInput.holderToken,
        );

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

    const subtotalMinorUnits = preparedItems.reduce(
      (sum, item) => sum + item.priceMinorUnits,
      0,
    );

    let discountMinorUnits = 0;
    let promoCodeId: string | null = null;
    if (dto.promoCode) {
      const promoCode = await this.promoCodesService.findValidForApplication(
        dto.eventId,
        dto.promoCode,
      );
      // Order-wide (applicableTicketTierId null) discounts off everything;
      // a tier-scoped code only discounts that tier's line items.
      const applicableSubtotal = promoCode.applicableTicketTierId
        ? preparedItems
            .filter((item) => item.ticketTierId === promoCode.applicableTicketTierId)
            .reduce((sum, item) => sum + item.priceMinorUnits, 0)
        : subtotalMinorUnits;

      if (promoCode.discountType === DiscountType.PERCENTAGE) {
        discountMinorUnits = Math.floor(
          (applicableSubtotal * promoCode.discountValue) / 100,
        );
      } else if (promoCode.discountType === DiscountType.FIXED) {
        discountMinorUnits = Math.min(promoCode.discountValue, applicableSubtotal);
      }
      // FREE_ITEM isn't a meaningful promo-code discount type here (that's
      // an Offers Service concept, bundled per ticket tier) — a code
      // created with it simply applies no discount.
      promoCodeId = promoCode.id;
    }

    const totalMinorUnits = subtotalMinorUnits - discountMinorUnits;

    const order = await this.ordersRepository.save(
      this.ordersRepository.create({
        buyerId: caller.sub,
        eventId: dto.eventId,
        status: OrderStatus.PENDING,
        subtotalMinorUnits,
        discountMinorUnits,
        totalMinorUnits,
        promoCodeId,
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

    if (promoCodeId) {
      await this.promoCodesService.incrementUsage(promoCodeId);
    }

    return { ...order, items: savedItems };
  }

  /**
   * Fire-and-forget: notifications are a non-critical side effect of order
   * confirmation/cancellation, never a reason for either to fail. A
   * notification-service outage just means the in-app notification never
   * arrives, logged here rather than propagated.
   */
  private notifyBuyer(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata: Record<string, unknown>,
  ): void {
    if (!this.notificationServiceUrl) return;
    firstValueFrom(
      this.httpService.post(
        `${this.notificationServiceUrl}/internal/notifications`,
        { userId, type, title, body, metadata },
        {
          headers: { "x-internal-secret": this.internalSecret },
          timeout: HTTP_TIMEOUT_MS,
        },
      ),
    ).catch((error) => {
      this.logger.warn(
        `Failed to notify user ${userId} (${type}): ${(error as Error).message}`,
      );
    });
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

  /**
   * No ownership check — for service-to-service callers only (see
   * InternalOrdersController), e.g. the Payment Service processing a
   * PayHere webhook that has no buyer JWT to present.
   */
  async findByIdInternal(id: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException("Order not found");
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

    const items = await this.orderItemsRepository.find({
      where: { orderId: order.id },
    });
    const seatedItems = items.filter((item) => item.seatId);
    if (seatedItems.length > 0) {
      const event = await this.fetchEvent(order.eventId).catch(() => null);
      if (event?.seatMapVersionId) {
        for (const item of seatedItems) {
          this.releaseSeatHold(event.seatMapVersionId, item.seatId!);
        }
      }
    }

    this.notifyBuyer(
      order.buyerId,
      NotificationType.ORDER_CANCELLED,
      "Your order was cancelled",
      "Your order has been cancelled.",
      { orderId: order.id, eventId: order.eventId },
    );
    return this.withItems(order);
  }

  /**
   * Restaurant-staff-scoped view for reporting — every order placed
   * against one of their events, regardless of buyer. Ownership is
   * enforced here (via the event's restaurantId) rather than per-order,
   * since orders themselves don't carry a restaurantId.
   */
  async findForEventAsStaff(
    eventId: string,
    caller: JwtAccessPayload,
  ): Promise<OrderWithItems[]> {
    const event = await this.fetchEvent(eventId);
    if (!isPlatformAdmin(caller) && caller.restaurantId !== event.restaurantId) {
      throw new ForbiddenException(
        "You may not view orders for this restaurant's event",
      );
    }
    const orders = await this.ordersRepository.find({
      where: { eventId },
      order: { createdAt: "DESC" },
    });
    return Promise.all(orders.map((order) => this.withItems(order)));
  }

  async platformTotals(): Promise<{
    totalOrders: number;
    confirmedOrders: number;
    totalRevenueMinorUnits: number;
    currency: string;
  }> {
    const totalOrders = await this.ordersRepository.count();
    const confirmedOrders = await this.ordersRepository.count({
      where: { status: OrderStatus.CONFIRMED },
    });
    const row = await this.ordersRepository
      .createQueryBuilder("order")
      .where("order.status IN (:...statuses)", {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.PAID],
      })
      .select("SUM(order.total_minor_units)", "total")
      .getRawOne<{ total: string | null }>();
    return {
      totalOrders,
      confirmedOrders,
      totalRevenueMinorUnits: Number(row?.total ?? 0),
      currency: "LKR",
    };
  }

  /**
   * Called by the Payment Service once a payment actually confirms.
   * Collapses PAID -> CONFIRMED into one transition for simplicity (the
   * distinction matters more once refund/dispute handling exists) and is
   * idempotent so a retried payment webhook never errors.
   */
  async confirmPayment(id: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    if (order.status === OrderStatus.CONFIRMED) {
      return this.withItems(order);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot confirm payment for an order in status ${order.status}`,
      );
    }
    order.status = OrderStatus.CONFIRMED;
    await this.ordersRepository.save(order);
    this.notifyBuyer(
      order.buyerId,
      NotificationType.ORDER_CONFIRMED,
      "Your order is confirmed",
      "Your payment went through and your order is confirmed. See you there!",
      { orderId: order.id, eventId: order.eventId },
    );
    return this.withItems(order);
  }
}
