import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom } from "rxjs";
import { isAxiosError } from "axios";
import * as QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { OrderStatus, TicketStatus, type JwtAccessPayload } from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant } from "../common/auth-helpers";
import { Ticket } from "./entities/ticket.entity";
import type { UpstreamEvent, UpstreamOrder } from "./upstream-types";

const HTTP_TIMEOUT_MS = 5000;

export interface TicketWithQr {
  id: string;
  orderItemId: string;
  eventId: string;
  ticketTierId: string;
  seatId: string | null;
  seatLabel: string | null;
  status: TicketStatus;
  checkedInAt: Date | null;
  qrCodeDataUrl: string;
}

export interface TicketLookupResult {
  id: string;
  orderItemId: string;
  eventTitle: string;
  ticketTierId: string;
  seatLabel: string | null;
  status: TicketStatus;
  checkedInAt: Date | null;
}

@Injectable()
export class TicketsService {
  private readonly orderServiceUrl = process.env.ORDER_SERVICE_URL;
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    private readonly httpService: HttpService,
  ) {}

  // ---------------------------------------------------------------------
  // Upstream fetch helpers
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
          throw new ForbiddenException("You may not view this order's tickets");
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

  // ---------------------------------------------------------------------
  // Lazy ticket generation
  // ---------------------------------------------------------------------

  async getForOrder(
    orderId: string,
    authorizationHeader: string,
  ): Promise<TicketWithQr[]> {
    const order = await this.fetchOrderAsCaller(orderId, authorizationHeader);
    if (order.status !== OrderStatus.CONFIRMED) {
      return [];
    }

    const existing = await this.ticketsRepository.find({
      where: { orderId },
    });
    const existingByItemId = new Map(
      existing.map((ticket) => [ticket.orderItemId, ticket]),
    );

    const tickets: Ticket[] = [];
    for (const item of order.items) {
      const already = existingByItemId.get(item.id);
      if (already) {
        tickets.push(already);
        continue;
      }
      try {
        const created = await this.ticketsRepository.save(
          this.ticketsRepository.create({
            orderId: order.id,
            orderItemId: item.id,
            buyerId: order.buyerId,
            eventId: order.eventId,
            ticketTierId: item.ticketTierId,
            seatId: item.seatId,
            seatLabel: item.seatLabel,
            qrToken: randomUUID(),
            status: TicketStatus.ISSUED,
          }),
        );
        tickets.push(created);
      } catch {
        // Unique-constraint race: another concurrent request created it
        // first. Re-fetch instead of erroring.
        const winner = await this.ticketsRepository.findOne({
          where: { orderItemId: item.id },
        });
        if (winner) {
          tickets.push(winner);
        }
      }
    }

    return Promise.all(
      tickets.map(async (ticket) => ({
        id: ticket.id,
        orderItemId: ticket.orderItemId,
        eventId: ticket.eventId,
        ticketTierId: ticket.ticketTierId,
        seatId: ticket.seatId,
        seatLabel: ticket.seatLabel,
        status: ticket.status,
        checkedInAt: ticket.checkedInAt,
        qrCodeDataUrl: await QRCode.toDataURL(ticket.qrToken),
      })),
    );
  }

  // ---------------------------------------------------------------------
  // Door-staff lookup / check-in
  // ---------------------------------------------------------------------

  private async getTicketAndEventOrThrow(
    qrToken: string,
    caller: JwtAccessPayload,
  ): Promise<{ ticket: Ticket; event: UpstreamEvent }> {
    const ticket = await this.ticketsRepository.findOne({
      where: { qrToken },
    });
    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }
    const event = await this.fetchEvent(ticket.eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "This ticket belongs to a different restaurant's event",
      );
    }
    return { ticket, event };
  }

  private toLookupResult(
    ticket: Ticket,
    event: UpstreamEvent,
  ): TicketLookupResult {
    return {
      id: ticket.id,
      orderItemId: ticket.orderItemId,
      eventTitle: event.title,
      ticketTierId: ticket.ticketTierId,
      seatLabel: ticket.seatLabel,
      status: ticket.status,
      checkedInAt: ticket.checkedInAt,
    };
  }

  async lookup(
    qrToken: string,
    caller: JwtAccessPayload,
  ): Promise<TicketLookupResult> {
    const { ticket, event } = await this.getTicketAndEventOrThrow(
      qrToken,
      caller,
    );
    return this.toLookupResult(ticket, event);
  }

  async checkIn(
    qrToken: string,
    caller: JwtAccessPayload,
  ): Promise<TicketLookupResult> {
    const { ticket, event } = await this.getTicketAndEventOrThrow(
      qrToken,
      caller,
    );
    if (ticket.status === TicketStatus.CHECKED_IN) {
      throw new ConflictException(
        `Already checked in at ${ticket.checkedInAt?.toISOString()}`,
      );
    }
    ticket.status = TicketStatus.CHECKED_IN;
    ticket.checkedInAt = new Date();
    ticket.checkedInByUserId = caller.sub;
    await this.ticketsRepository.save(ticket);
    return this.toLookupResult(ticket, event);
  }
}
