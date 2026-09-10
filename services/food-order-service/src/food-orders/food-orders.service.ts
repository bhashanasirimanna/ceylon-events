import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom } from "rxjs";
import { isAxiosError } from "axios";
import {
  FoodOrderStatus,
  OrderStatus,
  type FoodPreOrderSnapshot,
  type JwtAccessPayload,
  type MenuItemAggregate,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant } from "../common/auth-helpers";
import { BulkUpdateFoodOrderStatusDto } from "./dto/bulk-update-status.dto";
import { SubmitFoodPreOrderDto } from "./dto/submit-food-pre-order.dto";
import { UpdateFoodOrderStatusDto } from "./dto/update-status.dto";
import { FoodPreOrderItem } from "./entities/food-pre-order-item.entity";
import { FoodPreOrder } from "./entities/food-pre-order.entity";
import { FoodOrdersRealtimeService } from "./realtime/food-orders-realtime.service";
import type {
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
  private readonly orderServiceUrl = process.env.ORDER_SERVICE_URL;
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly restaurantServiceUrl = process.env.RESTAURANT_SERVICE_URL;
  private readonly venueServiceUrl = process.env.VENUE_SERVICE_URL;

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

  private findTableNumberForSeat(
    snapshot: UpstreamSeatMapSnapshot,
    seatId: string,
  ): string | null {
    for (const table of snapshot.tables) {
      if (table.seats.some((seat) => seat.id === seatId)) {
        return table.tableNumber;
      }
    }
    return null;
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

    const categories = await this.fetchMenu(event.restaurantId);
    const menuItemsById = new Map(
      categories.flatMap((category) =>
        category.items.map((item) => [item.id, item] as const),
      ),
    );

    const preparedItems = dto.items.map((itemInput) => {
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

    let tableNumber: string | null = null;
    if (orderItem.seatId && event.seatMapVersionId) {
      const snapshot = await this.fetchSeatMapSnapshot(event.seatMapVersionId);
      if (snapshot) {
        tableNumber = this.findTableNumberForSeat(snapshot, orderItem.seatId);
      }
    }

    let foodPreOrder = await this.foodPreOrdersRepository.findOne({
      where: { orderItemId },
    });
    if (foodPreOrder) {
      await this.itemsRepository.delete({ foodPreOrderId: foodPreOrder.id });
      foodPreOrder.seatId = orderItem.seatId;
      foodPreOrder.seatLabel = orderItem.seatLabel;
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
          tableNumber,
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
      tableNumber: foodPreOrder.tableNumber,
      status: foodPreOrder.status,
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
  ): Promise<FoodPreOrderSnapshot[]> {
    const event = await this.fetchEvent(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not view food pre-orders for this restaurant's event",
      );
    }
    const foodPreOrders = await this.foodPreOrdersRepository.find({
      where: status ? { eventId, status } : { eventId },
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

  // ---------------------------------------------------------------------
  // Status workflow
  // ---------------------------------------------------------------------

  private async getOwnedOrThrow(
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

  async updateStatus(
    orderItemId: string,
    dto: UpdateFoodOrderStatusDto,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrderSnapshot> {
    const foodPreOrder = await this.getOwnedOrThrow(orderItemId, caller);
    foodPreOrder.status = dto.status;
    await this.foodPreOrdersRepository.save(foodPreOrder);
    const snapshot = await this.withItems(foodPreOrder);
    this.realtimeService.publish(foodPreOrder.eventId, snapshot);
    return snapshot;
  }

  async bulkUpdateStatus(
    dto: BulkUpdateFoodOrderStatusDto,
    caller: JwtAccessPayload,
  ): Promise<FoodPreOrderSnapshot[]> {
    const results: FoodPreOrderSnapshot[] = [];
    for (const orderItemId of dto.orderItemIds) {
      const foodPreOrder = await this.getOwnedOrThrow(orderItemId, caller);
      foodPreOrder.status = dto.status;
      await this.foodPreOrdersRepository.save(foodPreOrder);
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
