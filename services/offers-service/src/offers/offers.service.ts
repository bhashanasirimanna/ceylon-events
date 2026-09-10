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
  RedemptionType,
  type JwtAccessPayload,
  type OfferSnapshot,
  type OfferWithRedemptionState,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant } from "../common/auth-helpers";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { UpdateOfferDto } from "./dto/update-offer.dto";
import { OfferRedemption } from "./entities/offer-redemption.entity";
import { OfferTicketTier } from "./entities/offer-ticket-tier.entity";
import { Offer } from "./entities/offer.entity";
import type { UpstreamEvent, UpstreamTicketLookup } from "./upstream-types";

const HTTP_TIMEOUT_MS = 5000;

@Injectable()
export class OffersService {
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly checkinServiceUrl = process.env.CHECKIN_SERVICE_URL;

  constructor(
    @InjectRepository(Offer)
    private readonly offersRepository: Repository<Offer>,
    @InjectRepository(OfferTicketTier)
    private readonly offerTicketTiersRepository: Repository<OfferTicketTier>,
    @InjectRepository(OfferRedemption)
    private readonly redemptionsRepository: Repository<OfferRedemption>,
    private readonly httpService: HttpService,
  ) {}

  // ---------------------------------------------------------------------
  // Upstream helpers
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
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException("Event not found");
      }
      throw new BadGatewayException("Event service is unavailable");
    }
  }

  private async lookupTicketAsCaller(
    qrToken: string,
    authorizationHeader: string,
  ): Promise<UpstreamTicketLookup> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamTicketLookup>(
          `${this.checkinServiceUrl}/tickets/${qrToken}/lookup`,
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
          throw new NotFoundException("Ticket not found");
        }
        if (error.response.status === 403) {
          throw new ForbiddenException(
            "This ticket belongs to a different restaurant's event",
          );
        }
        throw new BadGatewayException("Check-in service returned an error");
      }
      throw new BadGatewayException("Check-in service is unavailable");
    }
  }

  // ---------------------------------------------------------------------
  // Snapshot helpers
  // ---------------------------------------------------------------------

  private async toSnapshot(offer: Offer): Promise<OfferSnapshot> {
    const links = await this.offerTicketTiersRepository.find({
      where: { offerId: offer.id },
    });
    return {
      id: offer.id,
      eventId: offer.eventId,
      restaurantId: offer.restaurantId,
      name: offer.name,
      description: offer.description,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      redemptionType: offer.redemptionType,
      redemptionCap: offer.redemptionCap,
      applicableMenuCategoryId: offer.applicableMenuCategoryId,
      applicableMenuItemIds: offer.applicableMenuItemIds,
      ticketTierIds: links.map((link) => link.ticketTierId),
      createdAt: offer.createdAt.toISOString(),
      updatedAt: offer.updatedAt.toISOString(),
    };
  }

  /** CAPPED -> redemptionCap; SINGLE_USE -> implicit 1; UNLIMITED -> null. */
  private effectiveCap(offer: Offer): number | null {
    if (offer.redemptionType === RedemptionType.SINGLE_USE) return 1;
    if (offer.redemptionType === RedemptionType.CAPPED) {
      return offer.redemptionCap;
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Management (admin / restaurant staff)
  // ---------------------------------------------------------------------

  async create(
    eventId: string,
    dto: CreateOfferDto,
    caller: JwtAccessPayload,
  ): Promise<OfferSnapshot> {
    const event = await this.fetchEvent(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not manage offers for this restaurant's events",
      );
    }

    const offer = await this.offersRepository.save(
      this.offersRepository.create({
        eventId,
        restaurantId: event.restaurantId,
        name: dto.name,
        description: dto.description ?? null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        redemptionType: dto.redemptionType,
        redemptionCap: dto.redemptionCap ?? null,
        applicableMenuCategoryId: dto.applicableMenuCategoryId ?? null,
        applicableMenuItemIds: dto.applicableMenuItemIds ?? null,
      }),
    );

    await this.offerTicketTiersRepository.save(
      dto.ticketTierIds.map((ticketTierId) =>
        this.offerTicketTiersRepository.create({ offerId: offer.id, ticketTierId }),
      ),
    );

    return this.toSnapshot(offer);
  }

  async listForEvent(eventId: string): Promise<OfferSnapshot[]> {
    const offers = await this.offersRepository.find({
      where: { eventId },
      order: { createdAt: "ASC" },
    });
    return Promise.all(offers.map((offer) => this.toSnapshot(offer)));
  }

  async listForTicketTier(ticketTierId: string): Promise<OfferSnapshot[]> {
    const links = await this.offerTicketTiersRepository.find({
      where: { ticketTierId },
    });
    const offers = await Promise.all(
      links.map((link) =>
        this.offersRepository.findOne({ where: { id: link.offerId } }),
      ),
    );
    return Promise.all(
      offers.filter((offer): offer is Offer => !!offer).map((offer) => this.toSnapshot(offer)),
    );
  }

  private async getOrThrow(id: string): Promise<Offer> {
    const offer = await this.offersRepository.findOne({ where: { id } });
    if (!offer) {
      throw new NotFoundException("Offer not found");
    }
    return offer;
  }

  async findOne(id: string): Promise<OfferSnapshot> {
    return this.toSnapshot(await this.getOrThrow(id));
  }

  async update(
    id: string,
    dto: UpdateOfferDto,
    caller: JwtAccessPayload,
  ): Promise<OfferSnapshot> {
    const offer = await this.getOrThrow(id);
    if (!canManageRestaurant(caller, offer.restaurantId)) {
      throw new ForbiddenException(
        "You may not manage offers for this restaurant's events",
      );
    }
    if (dto.name !== undefined) offer.name = dto.name;
    if (dto.description !== undefined) offer.description = dto.description;
    if (dto.discountType !== undefined) offer.discountType = dto.discountType;
    if (dto.discountValue !== undefined) offer.discountValue = dto.discountValue;
    if (dto.redemptionType !== undefined) offer.redemptionType = dto.redemptionType;
    if (dto.redemptionCap !== undefined) offer.redemptionCap = dto.redemptionCap;
    if (dto.applicableMenuCategoryId !== undefined)
      offer.applicableMenuCategoryId = dto.applicableMenuCategoryId;
    if (dto.applicableMenuItemIds !== undefined)
      offer.applicableMenuItemIds = dto.applicableMenuItemIds;
    await this.offersRepository.save(offer);

    if (dto.ticketTierIds !== undefined) {
      await this.offerTicketTiersRepository.delete({ offerId: offer.id });
      await this.offerTicketTiersRepository.save(
        dto.ticketTierIds.map((ticketTierId) =>
          this.offerTicketTiersRepository.create({
            offerId: offer.id,
            ticketTierId,
          }),
        ),
      );
    }

    return this.toSnapshot(offer);
  }

  async delete(id: string, caller: JwtAccessPayload): Promise<void> {
    const offer = await this.getOrThrow(id);
    if (!canManageRestaurant(caller, offer.restaurantId)) {
      throw new ForbiddenException(
        "You may not manage offers for this restaurant's events",
      );
    }
    await this.redemptionsRepository.delete({ offerId: id });
    await this.offerTicketTiersRepository.delete({ offerId: id });
    await this.offersRepository.delete(id);
  }

  async listRedemptions(
    id: string,
    caller: JwtAccessPayload,
  ): Promise<OfferRedemption[]> {
    const offer = await this.getOrThrow(id);
    if (!canManageRestaurant(caller, offer.restaurantId)) {
      throw new ForbiddenException(
        "You may not view redemptions for this restaurant's offers",
      );
    }
    return this.redemptionsRepository.find({
      where: { offerId: id },
      order: { redeemedAt: "DESC" },
    });
  }

  // ---------------------------------------------------------------------
  // Staff redemption flow
  // ---------------------------------------------------------------------

  async offersForTicket(
    qrToken: string,
    authorizationHeader: string,
  ): Promise<OfferWithRedemptionState[]> {
    const ticket = await this.lookupTicketAsCaller(qrToken, authorizationHeader);
    const offers = await this.listForTicketTierEntities(ticket.ticketTierId);

    return Promise.all(
      offers.map(async (offer) => {
        const redeemedCount = await this.redemptionsRepository.count({
          where: { offerId: offer.id, orderItemId: ticket.orderItemId },
        });
        const cap = this.effectiveCap(offer);
        const snapshot = await this.toSnapshot(offer);
        return {
          ...snapshot,
          redeemedCount,
          remaining: cap === null ? null : Math.max(cap - redeemedCount, 0),
        };
      }),
    );
  }

  private async listForTicketTierEntities(
    ticketTierId: string,
  ): Promise<Offer[]> {
    const links = await this.offerTicketTiersRepository.find({
      where: { ticketTierId },
    });
    const offers = await Promise.all(
      links.map((link) =>
        this.offersRepository.findOne({ where: { id: link.offerId } }),
      ),
    );
    return offers.filter((offer): offer is Offer => !!offer);
  }

  async redeem(
    offerId: string,
    qrToken: string,
    notes: string | undefined,
    caller: JwtAccessPayload,
    authorizationHeader: string,
  ): Promise<OfferWithRedemptionState> {
    const offer = await this.getOrThrow(offerId);
    // The staff member's own bearer token is what proves they may manage
    // this restaurant's tickets — forward it as-is, matching how every
    // other cross-service call in this codebase delegates the caller's
    // own credentials rather than minting a new one.
    const ticket = await this.lookupTicketAsCaller(qrToken, authorizationHeader);

    const links = await this.offerTicketTiersRepository.find({
      where: { offerId },
    });
    if (!links.some((link) => link.ticketTierId === ticket.ticketTierId)) {
      throw new BadRequestException(
        "This offer is not bundled with this ticket's tier",
      );
    }

    const redeemedCount = await this.redemptionsRepository.count({
      where: { offerId, orderItemId: ticket.orderItemId },
    });
    const cap = this.effectiveCap(offer);
    if (cap !== null && redeemedCount >= cap) {
      throw new ConflictException(
        "This offer has already been fully redeemed for this ticket",
      );
    }

    await this.redemptionsRepository.save(
      this.redemptionsRepository.create({
        offerId,
        orderItemId: ticket.orderItemId,
        redeemedByUserId: caller.sub,
        notes: notes ?? null,
      }),
    );

    const snapshot = await this.toSnapshot(offer);
    const newCount = redeemedCount + 1;
    return {
      ...snapshot,
      redeemedCount: newCount,
      remaining: cap === null ? null : Math.max(cap - newCount, 0),
    };
  }
}
