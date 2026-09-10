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
import type {
  JwtAccessPayload,
  PromoCodeSnapshot,
  PromoCodeValidationResult,
} from "@ceylon/shared-types";
import { UserRole } from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { CreatePromoCodeDto } from "./dto/create-promo-code.dto";
import { UpdatePromoCodeDto } from "./dto/update-promo-code.dto";
import { PromoCode } from "./entities/promo-code.entity";

const HTTP_TIMEOUT_MS = 5000;

interface UpstreamEvent {
  id: string;
  restaurantId: string;
}

function isPlatformAdmin(user?: JwtAccessPayload | null): boolean {
  if (!user) return false;
  return user.roles.some(
    (role) => role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN,
  );
}

function canManageRestaurant(
  user: JwtAccessPayload | undefined,
  restaurantId: string,
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return user.restaurantId === restaurantId;
}

@Injectable()
export class PromoCodesService {
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;

  constructor(
    @InjectRepository(PromoCode)
    private readonly promoCodesRepository: Repository<PromoCode>,
    private readonly httpService: HttpService,
  ) {}

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

  private toSnapshot(promoCode: PromoCode): PromoCodeSnapshot {
    return {
      id: promoCode.id,
      eventId: promoCode.eventId,
      code: promoCode.code,
      discountType: promoCode.discountType,
      discountValue: promoCode.discountValue,
      applicableTicketTierId: promoCode.applicableTicketTierId,
      usageLimit: promoCode.usageLimit,
      usageCount: promoCode.usageCount,
      expiresAt: promoCode.expiresAt?.toISOString() ?? null,
      isActive: promoCode.isActive,
      createdAt: promoCode.createdAt.toISOString(),
      updatedAt: promoCode.updatedAt.toISOString(),
    };
  }

  async create(
    eventId: string,
    dto: CreatePromoCodeDto,
    caller: JwtAccessPayload,
  ): Promise<PromoCodeSnapshot> {
    const event = await this.fetchEvent(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not manage promo codes for this restaurant's events",
      );
    }
    const promoCode = await this.promoCodesRepository.save(
      this.promoCodesRepository.create({
        eventId,
        code: dto.code.toUpperCase(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        applicableTicketTierId: dto.applicableTicketTierId ?? null,
        usageLimit: dto.usageLimit ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );
    return this.toSnapshot(promoCode);
  }

  async listForEvent(
    eventId: string,
    caller: JwtAccessPayload,
  ): Promise<PromoCodeSnapshot[]> {
    const event = await this.fetchEvent(eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not view promo codes for this restaurant's events",
      );
    }
    const promoCodes = await this.promoCodesRepository.find({
      where: { eventId },
      order: { createdAt: "DESC" },
    });
    return promoCodes.map((promoCode) => this.toSnapshot(promoCode));
  }

  private async getOrThrow(id: string): Promise<PromoCode> {
    const promoCode = await this.promoCodesRepository.findOne({
      where: { id },
    });
    if (!promoCode) {
      throw new NotFoundException("Promo code not found");
    }
    return promoCode;
  }

  async update(
    id: string,
    dto: UpdatePromoCodeDto,
    caller: JwtAccessPayload,
  ): Promise<PromoCodeSnapshot> {
    const promoCode = await this.getOrThrow(id);
    const event = await this.fetchEvent(promoCode.eventId);
    if (!canManageRestaurant(caller, event.restaurantId)) {
      throw new ForbiddenException(
        "You may not manage promo codes for this restaurant's events",
      );
    }
    if (dto.discountType !== undefined) promoCode.discountType = dto.discountType;
    if (dto.discountValue !== undefined) promoCode.discountValue = dto.discountValue;
    if (dto.applicableTicketTierId !== undefined)
      promoCode.applicableTicketTierId = dto.applicableTicketTierId;
    if (dto.usageLimit !== undefined) promoCode.usageLimit = dto.usageLimit;
    if (dto.expiresAt !== undefined)
      promoCode.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.isActive !== undefined) promoCode.isActive = dto.isActive;
    await this.promoCodesRepository.save(promoCode);
    return this.toSnapshot(promoCode);
  }

  private checkValidity(promoCode: PromoCode): string | null {
    if (!promoCode.isActive) return "This promo code is no longer active";
    if (promoCode.expiresAt && promoCode.expiresAt.getTime() < Date.now()) {
      return "This promo code has expired";
    }
    if (
      promoCode.usageLimit !== null &&
      promoCode.usageCount >= promoCode.usageLimit
    ) {
      return "This promo code has reached its usage limit";
    }
    return null;
  }

  async validate(
    eventId: string,
    code: string,
  ): Promise<PromoCodeValidationResult> {
    const promoCode = await this.promoCodesRepository.findOne({
      where: { eventId, code: code.toUpperCase() },
    });
    if (!promoCode) {
      return { valid: false, reason: "Invalid promo code" };
    }
    const reason = this.checkValidity(promoCode);
    if (reason) {
      return { valid: false, reason, promoCode: this.toSnapshot(promoCode) };
    }
    return { valid: true, promoCode: this.toSnapshot(promoCode) };
  }

  /**
   * Used by order creation, not exposed directly — throws with a
   * buyer-facing message rather than returning a validation result,
   * since checkout should hard-stop on an invalid code.
   */
  async findValidForApplication(
    eventId: string,
    code: string,
  ): Promise<PromoCode> {
    const promoCode = await this.promoCodesRepository.findOne({
      where: { eventId, code: code.toUpperCase() },
    });
    if (!promoCode) {
      throw new BadRequestException("Invalid promo code");
    }
    const reason = this.checkValidity(promoCode);
    if (reason) {
      throw new BadRequestException(reason);
    }
    return promoCode;
  }

  /**
   * Best-effort, not perfectly race-safe under concurrent redemptions of
   * the same code near its usage limit — the same accepted limitation
   * already documented for the ticket-tier quantity-limit check
   * elsewhere in this service.
   */
  async incrementUsage(id: string): Promise<void> {
    await this.promoCodesRepository.increment({ id }, "usageCount", 1);
  }
}
