import {
  BadGatewayException,
  BadRequestException,
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
  FoodOrderSource,
  FoodOrderStatus,
  NotificationType,
  OrderStatus,
  aggregateTableStatuses,
  type FoodPreOrderSnapshot,
  type JwtAccessPayload,
  type MenuItemAggregate,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant } from "../common/auth-helpers";
import { BulkUpdateFoodOrderStatusDto } from "./dto/bulk-update-status.dto";
import { SubmitFoodPreOrderDto } from "./dto/submit-food-pre-order.dto";
import { SubmitWaiterFoodOrderDto } from "./dto/submit-waiter-food-order.dto";
import { UpdateFoodOrderStatusDto } from "./dto/update-status.dto";
import { FoodPreOrderItem } from "./entities/food-pre-order-item.entity";
import { FoodPreOrder } from "./entities/food-pre-order.entity";
import { FoodOrdersRealtimeService } from "./realtime/food-orders-realtime.service";
import type {
  UpstreamAvailability,
  UpstreamEvent,
  UpstreamMenuCategory,
  UpstreamOrder,
  UpstreamSeatMapSnapshot,
} from "./upstream-types";

const HTTP_TIMEOUT_MS = 5000;
const EDIT_CUTOFF_MINUTES = Number(
  process.env.FOOD_ORDER_EDIT_CUTOFF_MINUTES ?? 120,
);

@Injectable()
export class FoodOrdersService {
  private readonly logger = new Logger(FoodOrdersService.name);
  private readonly orderServiceUrl = process.env.ORDER_SERVICE_URL;
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly restaurantServiceUrl = process.env.RESTAURANT_SERVICE_URL;
  private readonly venueServiceUrl = process.env.VENUE_SERVICE_URL;
  private readonly notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL;
  private readonly internalSecret = process.env.INTERNAL_SERVICE_SECRET ?? "";

  constructor(
    @InjectRepository(FoodPreOrder)
    private readonly foodPreOrdersRepository: Repository<FoodPreOrder>,
    @InjectRepository(FoodPreOrderItem)
    private readonly itemsRepository: Repository<FoodPreOrderItem>,
    private readonly httpService: HttpService,
    private readonly realtimeService: FoodOrdersRealtimeService,
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
          throw new ForbiddenException("You may not pre-order food for this order");
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

  private async fetchMenu(
    restaurantId: string,
  ): Promise<UpstreamMenuCategory[]> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamMenuCategory[]>(
          `${this.restaurantServiceUrl}/restaurants/${restaurantId}/menu`,
          { timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch {
      throw new BadGatewayException("Restaurant service is unavailable");
    }
  }

  private async fetchSeatMapSnapshot(
    seatMapVersionId: string,
  ): Promise<UpstreamSeatMapSnapshot | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamSeatMapSnapshot>(
          `${this.venueServiceUrl}/seat-map-versions/${seatMapVersionId}`,
          { timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch {
      return null;
    }
  }

  private async fetchAvailability(
    seatMapVersionId: string,
  ): Promise<UpstreamAvailability | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamAvailability>(
          `${this.venueServiceUrl}/seat-map-versions/${seatMapVersionId}/availability`,
          { timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch {
      return null;
    }
  }

  private findTableForSeat(
    snapshot: UpstreamSeatMapSnapshot,
    seatId: string,
  ): { id: string; tableNumber: string } | null {
    for (const table of snapshot.tables) {
      if (table.seats.some((seat) => seat.id === seatId)) {
        return { id: table.id, tableNumber: table.tableNumber };
      }
    }
    return null;
  }

  /**
   * Shared by both the customer pre-order flow and the waiter table-order
   * flow: never trust a client-supplied item name/price, always resolve
   * against the restaurant's own current menu.
   */
  private async resolveMenuItems(
    restaurantId: string,
    items: Array<{ menuItemId: string; quantity: number; notes?: string }>,
  ): Promise<
    Array<{
      menuItemId: string;
      menuItemName: string;
      quantity: number;
      notes: string | null;
      priceMinorUnits: number;
    }>
  > {
    const categories = await this.fetchMenu(restaurantId);
    const menuItemsById = new Map(
      categories.flatMap((category) =>
        category.items.map((item) => [item.id, item] as const),
      ),
    );

    return items.map((itemInput) => {
      const menuItem = menuItemsById.get(itemInput.menuItemId);
      if (!menuItem) {
        throw new BadRequestException(
          `Menu item ${itemInput.menuItemId} not found on this restaurant's menu`,
        );
      }
      if (!menuItem.isAvailable) {
        throw new BadRequestException(`"${menuItem.name}" is not currently available`);
      }
      return {
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        quantity: itemInput.quantity,
        notes: itemInput.notes ?? null,
        priceMinorUnits: menuItem.priceMinorUnits,
      };
    });
  }

  // ---------------------------------------------------------------------
  // Submit / replace
  // ---------------------------------------------------------------------

  async submit(
    orderItemId: string,
    dto: SubmitFoodPreOrderDto,
    authorizationHeader: string,
  ): Promise<FoodPreOrderSnapshot> {
    const order = await this.fetchOrderAsCaller(dto.orderId, authorizationHeader);
    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new BadRequestException(
        "Cannot pre-order food for a cancelled order",
      );
    }

    const orderItem = order.items.find((item) => item.id === orderItemId);
    if (!orderItem) {
      throw new NotFoundException("This ticket was not found on that order");
    }

    const event = await this.fetchEvent(order.eventId);
    const cutoff = new Date(event.startsAt).getTime() - EDIT_CUTOFF_MINUTES * 60_000;
    if (Date.now() >= cutoff) {
      throw new BadRequestException(
        `Food pre-order editing has closed for this event (cutoff is ${EDIT_CUTOFF_MINUTES} minutes before it starts)`,
      );
    }

    const preparedItems = await this.resolveMenuItems(event.restaurantId, dto.items);

    let tableId: string | null = null;
    let tableNumber: string | null = null;
    if (orderItem.seatId && event.seatMapVersionId) {
      const snapshot = await this.fetchSeatMapSnapshot(event.seatMapVersionId);
      if (snapshot) {
        const table = this.findTableForSeat(snapshot, orderItem.seatId);
        tableId = table?.id ?? null;
        tableNumber = table?.tableNumber ?? null;
      }
    }

    let foodPreOrder = await this.foodPreOrdersRepository.findOne({
      where: { orderItemId },
    });
    if (foodPreOrder) {
      await this.itemsRepository.delete({ foodPreOrderId: foodPreOrder.id });
      foodPreOrder.seatId = orderItem.seatId;
      foodPreOrder.seatLabel = orderItem.seatLabel;
      foodPreOrder.tableId = tableId;
      foodPreOrder.tableNumber = tableNumber;
      foodPreOrder = await this.foodPreOrdersRepository.save(foodPreOrder);
    } else {
      foodPreOrder = await this.foodPreOrdersRepository.save(
        this.foodPreOrdersRepository.create({
          orderId: order.id,
          orderItemId,
          eventId: order.eventId,
          restaurantId: event.restaurantId,
          buyerId: order.buyerId,
          seatId: orderItem.seatId,
          seatLabel: orderItem.seatLabel,
          tableId,
          tableNumber,
          source: FoodOrderSource.PRE_ORDER,
          status: FoodOrderStatus.RECEIVED,
        }),
      );
    }

    const savedItems = await this.itemsRepository.save(
      preparedItems.map((item) =>
        this.itemsRepository.create({
          foodPreOrderId: foodPreOrder!.id,
          ...item,
        }),
      ),
    );

    const snapshot = this.toSnapshot(foodPreOrder, savedItems);
    this.realtimeService.publish(order.eventId, snapshot);
    return snapshot;
  }

  // ---------------------------------------------------------------------
  // Staff / waiter table orders
  // ---------------------------------------------------------------------

  /**
   * Creates a food order directly against a table, on behalf of an
   * authenticated waiter — no ticket/order-item selection required. The
   * table must belong to the event's own seat map and already have at
   * least one sold seat (i.e. a real confirmed booking); an available or
   * merely-held table is rejected rather than silently "walk-in" booked,
   * since this system has no walk-in concept.
   */
  async createWaiterOrder(
    dto: SubmitWaiterFoodOrderDto,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrderSnapshot> {
    // Idempotency: a resubmission with the same key returns the order
    // already created for it rather than creating a duplicate.
    if (dto.clientRequestId) {
      const existing = await this.foodPreOrdersRepository.findOne({
        where: { clientRequestId: dto.clientRequestId },
      });
      if (existing) {
        return this.withItems(existing);
      }
    }

    const event = await this.fetchEvent(dto.eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not create food orders for this restaurant's event",
      );
    }
    if (!event.seatMapVersionId) {
      throw new BadRequestException("This event has no table map");
    }

    const snapshot = await this.fetchSeatMapSnapshot(event.seatMapVersionId);
    const table = snapshot?.tables.find((t) => t.id === dto.tableId);
    if (!snapshot || !table) {
      throw new NotFoundException(
        "Table could not be found for this event",
      );
    }

    const availability = await this.fetchAvailability(event.seatMapVersionId);
    if (!availability) {
      throw new BadGatewayException("Venue service is unavailable");
    }
    const tableStatuses = aggregateTableStatuses(snapshot, availability);
    if (tableStatuses[table.id] !== "BOOKED") {
      throw new BadRequestException(
        "This table does not have an active confirmed booking for this event",
      );
    }

    const preparedItems = await this.resolveMenuItems(
      event.restaurantId,
      dto.items,
    );

    let foodPreOrder: FoodPreOrder;
    try {
      foodPreOrder = await this.foodPreOrdersRepository.save(
        this.foodPreOrdersRepository.create({
          orderId: null,
          orderItemId: null,
          eventId: event.id,
          restaurantId: event.restaurantId,
          buyerId: null,
          seatId: null,
          seatLabel: null,
          tableId: table.id,
          tableNumber: table.tableNumber,
          source: FoodOrderSource.WAITER,
          createdByUserId: caller.sub,
          notes: dto.notes ?? null,
          clientRequestId: dto.clientRequestId ?? null,
          status: FoodOrderStatus.RECEIVED,
        }),
      );
    } catch (error) {
      // Unique-constraint race on clientRequestId: another concurrent
      // request (the same double-tap) already created it — same pattern
      // as checkin-service's lazy ticket generation.
      if (dto.clientRequestId) {
        const winner = await this.foodPreOrdersRepository.findOne({
          where: { clientRequestId: dto.clientRequestId },
        });
        if (winner) {
          return this.withItems(winner);
        }
      }
      throw error;
    }

    const savedItems = await this.itemsRepository.save(
      preparedItems.map((item) =>
        this.itemsRepository.create({
          foodPreOrderId: foodPreOrder.id,
          ...item,
        }),
      ),
    );

    const result = this.toSnapshot(foodPreOrder, savedItems);
    this.realtimeService.publish(event.id, result);
    return result;
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  private toSnapshot(
    foodPreOrder: FoodPreOrder,
    items: FoodPreOrderItem[],
  ): FoodPreOrderSnapshot {
    return {
      id: foodPreOrder.id,
      orderId: foodPreOrder.orderId,
      orderItemId: foodPreOrder.orderItemId,
      eventId: foodPreOrder.eventId,
      restaurantId: foodPreOrder.restaurantId,
      buyerId: foodPreOrder.buyerId,
      seatId: foodPreOrder.seatId,
      seatLabel: foodPreOrder.seatLabel,
      tableId: foodPreOrder.tableId,
      tableNumber: foodPreOrder.tableNumber,
      status: foodPreOrder.status,
      source: foodPreOrder.source,
      createdByUserId: foodPreOrder.createdByUserId,
      notes: foodPreOrder.notes,
      items: items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        quantity: item.quantity,
        notes: item.notes,
        priceMinorUnits: item.priceMinorUnits,
      })),
      createdAt: foodPreOrder.createdAt.toISOString(),
      updatedAt: foodPreOrder.updatedAt.toISOString(),
    };
  }

  private async withItems(
    foodPreOrder: FoodPreOrder,
  ): Promise<FoodPreOrderSnapshot> {
    const items = await this.itemsRepository.find({
      where: { foodPreOrderId: foodPreOrder.id },
    });
    return this.toSnapshot(foodPreOrder, items);
  }

  async getForOrderItem(
    orderItemId: string,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrderSnapshot | null> {
    const foodPreOrder = await this.foodPreOrdersRepository.findOne({
      where: { orderItemId },
    });
    if (!foodPreOrder) {
      return null;
    }
    if (
      foodPreOrder.buyerId !== caller.sub &&
      !canManageRestaurant(caller, foodPreOrder.restaurantId)
    ) {
      throw new ForbiddenException("You may not view this food pre-order");
    }
    return this.withItems(foodPreOrder);
  }

  async listForEvent(
    eventId: string,
    status: FoodOrderStatus | undefined,
    caller: JwtAccessPayload,
    tableId?: string,
  ): Promise<FoodPreOrderSnapshot[]> {
    const event = await this.fetchEvent(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not view food pre-orders for this restaurant's event",
      );
    }
    const foodPreOrders = await this.foodPreOrdersRepository.find({
      where: { eventId, ...(status ? { status } : {}), ...(tableId ? { tableId } : {}) },
      order: { tableNumber: "ASC", createdAt: "ASC" },
    });
    return Promise.all(foodPreOrders.map((fpo) => this.withItems(fpo)));
  }

  async summaryForEvent(
    eventId: string,
    caller: JwtAccessPayload,
  ): Promise<MenuItemAggregate[]> {
    const event = await this.fetchEvent(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not view this restaurant's event summary",
      );
    }
    const rows = await this.itemsRepository
      .createQueryBuilder("item")
      .innerJoin("food_pre_orders", "fpo", "fpo.id = item.food_pre_order_id")
      .where("fpo.event_id = :eventId", { eventId })
      .select("item.menu_item_id", "menuItemId")
      .addSelect("item.menu_item_name", "menuItemName")
      .addSelect("SUM(item.quantity)", "totalQuantity")
      .groupBy("item.menu_item_id")
      .addGroupBy("item.menu_item_name")
      .orderBy("SUM(item.quantity)", "DESC")
      .getRawMany<{
        menuItemId: string;
        menuItemName: string;
        totalQuantity: string;
      }>();

    return rows.map((row) => ({
      menuItemId: row.menuItemId,
      menuItemName: row.menuItemName,
      totalQuantity: Number(row.totalQuantity),
    }));
  }

  /**
   * Fire-and-forget: same reasoning as order-service's equivalent helper —
   * a notification-service outage must never block the kitchen status
   * workflow.
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

  private notifyIfReady(foodPreOrder: FoodPreOrder): void {
    if (foodPreOrder.status !== FoodOrderStatus.READY) return;
    // Waiter-sourced orders have no single buyer to notify — the guest
    // finds out their food is ready from the waiter, not a push notification.
    if (!foodPreOrder.buyerId) return;
    this.notifyBuyer(
      foodPreOrder.buyerId,
      NotificationType.FOOD_ORDER_READY,
      "Your food is ready",
      foodPreOrder.tableNumber
        ? `Your food pre-order is ready at table ${foodPreOrder.tableNumber}.`
        : "Your food pre-order is ready.",
      { orderItemId: foodPreOrder.orderItemId, eventId: foodPreOrder.eventId },
    );
  }

  // ---------------------------------------------------------------------
  // Status workflow
  // ---------------------------------------------------------------------

  private async getOwnedByOrderItemOrThrow(
    orderItemId: string,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrder> {
    const foodPreOrder = await this.foodPreOrdersRepository.findOne({
      where: { orderItemId },
    });
    if (!foodPreOrder) {
      throw new NotFoundException("Food pre-order not found");
    }
    if (!canManageRestaurant(caller, foodPreOrder.restaurantId)) {
      throw new ForbiddenException(
        "You may not manage food pre-orders for this restaurant",
      );
    }
    return foodPreOrder;
  }

  // Keyed by the food order's own id — the one identifier a WAITER-sourced
  // order always has (it has no orderItemId). Used for both sources going
  // forward by the restaurant dashboard / table page.
  private async getOwnedByIdOrThrow(
    id: string,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrder> {
    const foodPreOrder = await this.foodPreOrdersRepository.findOne({
      where: { id },
    });
    if (!foodPreOrder) {
      throw new NotFoundException("Food order not found");
    }
    if (!canManageRestaurant(caller, foodPreOrder.restaurantId)) {
      throw new ForbiddenException(
        "You may not manage food orders for this restaurant",
      );
    }
    return foodPreOrder;
  }

  async updateStatus(
    orderItemId: string,
    dto: UpdateFoodOrderStatusDto,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrderSnapshot> {
    const foodPreOrder = await this.getOwnedByOrderItemOrThrow(orderItemId, caller);
    foodPreOrder.status = dto.status;
    await this.foodPreOrdersRepository.save(foodPreOrder);
    this.notifyIfReady(foodPreOrder);
    const snapshot = await this.withItems(foodPreOrder);
    this.realtimeService.publish(foodPreOrder.eventId, snapshot);
    return snapshot;
  }

  async updateStatusById(
    id: string,
    dto: UpdateFoodOrderStatusDto,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrderSnapshot> {
    const foodPreOrder = await this.getOwnedByIdOrThrow(id, caller);
    foodPreOrder.status = dto.status;
    await this.foodPreOrdersRepository.save(foodPreOrder);
    this.notifyIfReady(foodPreOrder);
    const snapshot = await this.withItems(foodPreOrder);
    this.realtimeService.publish(foodPreOrder.eventId, snapshot);
    return snapshot;
  }

  async bulkUpdateStatus(
    dto: BulkUpdateFoodOrderStatusDto,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrderSnapshot[]> {
    const results: FoodPreOrderSnapshot[] = [];
    for (const id of dto.ids) {
      const foodPreOrder = await this.getOwnedByIdOrThrow(id, caller);
      foodPreOrder.status = dto.status;
      await this.foodPreOrdersRepository.save(foodPreOrder);
      this.notifyIfReady(foodPreOrder);
      const snapshot = await this.withItems(foodPreOrder);
      this.realtimeService.publish(foodPreOrder.eventId, snapshot);
      results.push(snapshot);
    }
    return results;
  }

  /** For the SSE guard to check restaurant ownership before subscribing. */
  async assertCanManageEvent(
    eventId: string,
    caller: JwtAccessPayload,
  ): Promise<void> {
    const event = await this.fetchEvent(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not view food pre-orders for this restaurant's event",
      );
    }
  }
}
