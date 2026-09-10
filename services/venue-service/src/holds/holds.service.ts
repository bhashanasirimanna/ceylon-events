import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { SeatStatus } from "@ceylon/shared-types";
import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import { Repository } from "typeorm";
import { SoldSeat } from "../seat-maps/entities/sold-seat.entity";
import { REDIS_CLIENT } from "./redis.provider";

const DEFAULT_TTL_SECONDS = Number(
  process.env.SEAT_HOLD_TTL_SECONDS ?? 300,
);

export interface HoldResult {
  seatId: string;
  holderToken: string;
  expiresAt: string;
}

@Injectable()
export class HoldsService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(SoldSeat)
    private readonly soldSeatRepository: Repository<SoldSeat>,
  ) {}

  private holdKey(versionId: string, seatId: string): string {
    return `seat-hold:${versionId}:${seatId}`;
  }

  async createHold(
    versionId: string,
    seatId: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<HoldResult> {
    const sold = await this.soldSeatRepository.findOne({
      where: { seatMapVersionId: versionId, seatId },
    });
    if (sold) {
      throw new ConflictException("Seat has already been sold");
    }

    const holderToken = randomUUID();
    const key = this.holdKey(versionId, seatId);
    const result = await this.redis.set(
      key,
      holderToken,
      "EX",
      ttlSeconds,
      "NX",
    );
    if (result !== "OK") {
      throw new ConflictException("Seat is currently held by another buyer");
    }

    return {
      seatId,
      holderToken,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async renewHold(
    versionId: string,
    seatId: string,
    holderToken: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<HoldResult> {
    const key = this.holdKey(versionId, seatId);
    const current = await this.redis.get(key);
    if (!current) {
      throw new NotFoundException("Hold has expired");
    }
    if (current !== holderToken) {
      throw new ForbiddenException("Hold token does not match");
    }
    await this.redis.expire(key, ttlSeconds);
    return {
      seatId,
      holderToken,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async releaseHold(
    versionId: string,
    seatId: string,
    holderToken: string,
  ): Promise<void> {
    const key = this.holdKey(versionId, seatId);
    const current = await this.redis.get(key);
    if (!current) {
      return;
    }
    if (current !== holderToken) {
      throw new ForbiddenException("Hold token does not match");
    }
    await this.redis.del(key);
  }

  /**
   * Resolves status for every seat in one pass: a single Redis MGET plus one
   * Postgres query for sold seats, rather than a round trip per seat.
   */
  async getAvailability(
    versionId: string,
    seatIds: string[],
    requesterToken?: string,
  ): Promise<Record<string, SeatStatus>> {
    const soldSeats = await this.soldSeatRepository.find({
      where: { seatMapVersionId: versionId },
    });
    const soldSeatIds = new Set(soldSeats.map((s) => s.seatId));

    const keys = seatIds.map((seatId) => this.holdKey(versionId, seatId));
    const holderTokens = keys.length
      ? await this.redis.mget(...keys)
      : [];

    const result: Record<string, SeatStatus> = {};
    seatIds.forEach((seatId, index) => {
      if (soldSeatIds.has(seatId)) {
        result[seatId] = SeatStatus.SOLD;
        return;
      }
      const holder = holderTokens[index];
      if (!holder) {
        result[seatId] = SeatStatus.AVAILABLE;
      } else if (requesterToken && holder === requesterToken) {
        result[seatId] = SeatStatus.HELD_BY_ME;
      } else {
        result[seatId] = SeatStatus.HELD;
      }
    });
    return result;
  }

  async markSold(
    versionId: string,
    seatId: string,
    orderId?: string,
  ): Promise<void> {
    const existing = await this.soldSeatRepository.findOne({
      where: { seatMapVersionId: versionId, seatId },
    });
    if (existing) {
      return;
    }
    await this.soldSeatRepository.save(
      this.soldSeatRepository.create({
        seatMapVersionId: versionId,
        seatId,
        orderId: orderId ?? null,
      }),
    );
    // Sold seats no longer need a temporary hold.
    await this.redis.del(this.holdKey(versionId, seatId));
  }
}
