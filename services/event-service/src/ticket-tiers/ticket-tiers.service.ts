import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { JwtAccessPayload } from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant } from "../common/auth-helpers";
import { Event } from "../events/entities/event.entity";
import { CreateTicketTierDto } from "./dto/create-ticket-tier.dto";
import { UpdateTicketTierDto } from "./dto/update-ticket-tier.dto";
import { TicketTier } from "./entities/ticket-tier.entity";

@Injectable()
export class TicketTiersService {
  constructor(
    @InjectRepository(TicketTier)
    private readonly tiersRepository: Repository<TicketTier>,
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  private async getEventOrThrow(eventId: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    return event;
  }

  async create(
    eventId: string,
    dto: CreateTicketTierDto,
    caller: JwtAccessPayload,
  ): Promise<TicketTier> {
    const event = await this.getEventOrThrow(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may only manage ticket tiers for your own restaurant's events",
      );
    }
    const tier = this.tiersRepository.create({
      eventId,
      name: dto.name,
      priceMinorUnits: dto.priceMinorUnits,
      currency: dto.currency ?? "LKR",
      saleStartAt: dto.saleStartAt ? new Date(dto.saleStartAt) : null,
      saleEndAt: dto.saleEndAt ? new Date(dto.saleEndAt) : null,
      allowedSectionIds: dto.allowedSectionIds ?? null,
      quantityLimit: dto.quantityLimit ?? null,
    });
    return this.tiersRepository.save(tier);
  }

  async listForEvent(eventId: string): Promise<TicketTier[]> {
    return this.tiersRepository.find({
      where: { eventId },
      order: { priceMinorUnits: "ASC" },
    });
  }

  async findByIdOrThrow(id: string): Promise<TicketTier> {
    const tier = await this.tiersRepository.findOne({ where: { id } });
    if (!tier) {
      throw new NotFoundException("Ticket tier not found");
    }
    return tier;
  }

  async update(
    id: string,
    dto: UpdateTicketTierDto,
    caller: JwtAccessPayload,
  ): Promise<TicketTier> {
    const tier = await this.findByIdOrThrow(id);
    const event = await this.getEventOrThrow(tier.eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may only manage ticket tiers for your own restaurant's events",
      );
    }
    if (dto.name !== undefined) tier.name = dto.name;
    if (dto.priceMinorUnits !== undefined)
      tier.priceMinorUnits = dto.priceMinorUnits;
    if (dto.currency !== undefined) tier.currency = dto.currency;
    if (dto.saleStartAt !== undefined)
      tier.saleStartAt = dto.saleStartAt ? new Date(dto.saleStartAt) : null;
    if (dto.saleEndAt !== undefined)
      tier.saleEndAt = dto.saleEndAt ? new Date(dto.saleEndAt) : null;
    if (dto.allowedSectionIds !== undefined)
      tier.allowedSectionIds = dto.allowedSectionIds;
    if (dto.quantityLimit !== undefined)
      tier.quantityLimit = dto.quantityLimit;
    return this.tiersRepository.save(tier);
  }

  async delete(id: string, caller: JwtAccessPayload): Promise<void> {
    const tier = await this.findByIdOrThrow(id);
    const event = await this.getEventOrThrow(tier.eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may only manage ticket tiers for your own restaurant's events",
      );
    }
    await this.tiersRepository.delete(id);
  }
}
