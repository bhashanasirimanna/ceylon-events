import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { isAxiosError } from "axios";
import type { EventReport, PlatformTotals, RestaurantReport } from "@ceylon/shared-types";
import type {
  UpstreamEvent,
  UpstreamMenuItemAggregate,
  UpstreamOrderForReport,
  UpstreamPaginated,
  UpstreamPlatformOrderTotals,
  UpstreamRatingSummary,
  UpstreamRestaurant,
  UpstreamTicketTier,
} from "./upstream-types";

const HTTP_TIMEOUT_MS = 5000;

@Injectable()
export class ReportsService {
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly orderServiceUrl = process.env.ORDER_SERVICE_URL;
  private readonly foodOrderServiceUrl = process.env.FOOD_ORDER_SERVICE_URL;
  private readonly ratingsServiceUrl = process.env.RATINGS_SERVICE_URL;
  private readonly restaurantServiceUrl = process.env.RESTAURANT_SERVICE_URL;

  constructor(private readonly httpService: HttpService) {}

  // ---------------------------------------------------------------------
  // Upstream helpers — this service holds no data of its own, only
  // composes already-authorized reads from the services that do,
  // forwarding the caller's own bearer token exactly like they'd call
  // those endpoints directly.
  // ---------------------------------------------------------------------

  private async get<T>(url: string, authorizationHeader?: string): Promise<T> {
    const res = await firstValueFrom(
      this.httpService.get<T>(url, {
        headers: authorizationHeader ? { Authorization: authorizationHeader } : {},
        timeout: HTTP_TIMEOUT_MS,
      }),
    );
    return res.data;
  }

  private async getOrNull<T>(
    url: string,
    authorizationHeader?: string,
  ): Promise<T | null> {
    try {
      return await this.get<T>(url, authorizationHeader);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------

  async eventReport(
    eventId: string,
    authorizationHeader: string,
  ): Promise<EventReport> {
    let event: UpstreamEvent;
    try {
      event = await this.get<UpstreamEvent>(
        `${this.eventServiceUrl}/events/${eventId}`,
        authorizationHeader,
      );
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException("Event not found");
      }
      throw new BadGatewayException("Event service is unavailable");
    }

    const tiers =
      (await this.getOrNull<UpstreamTicketTier[]>(
        `${this.eventServiceUrl}/events/${eventId}/ticket-tiers`,
        authorizationHeader,
      )) ?? [];

    let orders: UpstreamOrderForReport[];
    try {
      orders = await this.get<UpstreamOrderForReport[]>(
        `${this.orderServiceUrl}/orders/by-event/${eventId}`,
        authorizationHeader,
      );
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 403) {
        throw new ForbiddenException("You may not view this event's report");
      }
      throw new BadGatewayException("Order service is unavailable");
    }

    const countedOrders = orders.filter(
      (order) => order.status === "CONFIRMED" || order.status === "PAID",
    );
    const ticketsSold = countedOrders.reduce(
      (sum, order) => sum + order.items.length,
      0,
    );
    const revenueMinorUnits = countedOrders.reduce(
      (sum, order) => sum + order.totalMinorUnits,
      0,
    );
    const currency = orders[0]?.currency ?? "LKR";

    const tierBreakdown = tiers.map((tier) => {
      const items = countedOrders
        .flatMap((order) => order.items)
        .filter((item) => item.ticketTierId === tier.id);
      return {
        ticketTierId: tier.id,
        ticketTierName: tier.name,
        sold: items.length,
        revenueMinorUnits: items.reduce(
          (sum, item) => sum + item.priceMinorUnits,
          0,
        ),
      };
    });

    const foodItemSummary =
      (await this.getOrNull<UpstreamMenuItemAggregate[]>(
        `${this.foodOrderServiceUrl}/food-pre-orders/by-event/${eventId}/summary`,
        authorizationHeader,
      )) ?? [];

    const ratingSummary = (await this.getOrNull<UpstreamRatingSummary>(
      `${this.ratingsServiceUrl}/ratings/summary?subjectType=EVENT&subjectId=${eventId}`,
    )) ?? { average: null, count: 0 };

    return {
      eventId: event.id,
      eventTitle: event.title,
      restaurantId: event.restaurantId,
      startsAt: event.startsAt,
      ticketsSold,
      revenueMinorUnits,
      currency,
      tierBreakdown,
      foodItemSummary,
      ratingSummary,
    };
  }

  async restaurantReport(
    restaurantId: string,
    authorizationHeader: string,
  ): Promise<RestaurantReport> {
    let restaurant: UpstreamRestaurant;
    try {
      restaurant = await this.get<UpstreamRestaurant>(
        `${this.restaurantServiceUrl}/restaurants/${restaurantId}`,
        authorizationHeader,
      );
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException("Restaurant not found");
      }
      throw new BadGatewayException("Restaurant service is unavailable");
    }

    let eventsPage: UpstreamPaginated<UpstreamEvent>;
    try {
      eventsPage = await this.get<UpstreamPaginated<UpstreamEvent>>(
        `${this.eventServiceUrl}/events?restaurantId=${restaurantId}&pageSize=100`,
        authorizationHeader,
      );
    } catch {
      throw new BadGatewayException("Event service is unavailable");
    }

    // Per-event reports run sequentially with a best-effort catch: one
    // event's report failing (e.g. a transient upstream blip) shouldn't
    // blank the whole restaurant rollup, just that event's contribution.
    const events: Array<{ event: UpstreamEvent; report: EventReport | null }> = [];
    for (const event of eventsPage.items) {
      const report = await this.eventReport(event.id, authorizationHeader).catch(
        () => null,
      );
      events.push({ event, report });
    }

    const ticketsSold = events.reduce(
      (sum, e) => sum + (e.report?.ticketsSold ?? 0),
      0,
    );
    const revenueMinorUnits = events.reduce(
      (sum, e) => sum + (e.report?.revenueMinorUnits ?? 0),
      0,
    );
    const currency = events.find((e) => e.report)?.report?.currency ?? "LKR";

    const ratingSummary = (await this.getOrNull<UpstreamRatingSummary>(
      `${this.ratingsServiceUrl}/ratings/summary?restaurantId=${restaurantId}`,
    )) ?? { average: null, count: 0 };

    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      eventCount: eventsPage.items.length,
      ticketsSold,
      revenueMinorUnits,
      currency,
      ratingSummary,
      events: events.map(({ event, report }) => ({
        eventId: event.id,
        eventTitle: event.title,
        startsAt: event.startsAt,
        ticketsSold: report?.ticketsSold ?? 0,
        revenueMinorUnits: report?.revenueMinorUnits ?? 0,
      })),
    };
  }

  async platformTotals(authorizationHeader: string): Promise<PlatformTotals> {
    const [orderTotals, restaurants, events] = await Promise.all([
      this.get<UpstreamPlatformOrderTotals>(
        `${this.orderServiceUrl}/orders/reports/platform-totals`,
        authorizationHeader,
      ),
      this.get<UpstreamPaginated<UpstreamRestaurant>>(
        `${this.restaurantServiceUrl}/restaurants?pageSize=1`,
        authorizationHeader,
      ),
      this.get<UpstreamPaginated<UpstreamEvent>>(
        `${this.eventServiceUrl}/events?pageSize=1`,
        authorizationHeader,
      ),
    ]);

    return {
      totalOrders: orderTotals.totalOrders,
      confirmedOrders: orderTotals.confirmedOrders,
      totalRevenueMinorUnits: orderTotals.totalRevenueMinorUnits,
      currency: orderTotals.currency,
      totalRestaurants: restaurants.total,
      totalEvents: events.total,
    };
  }
}
