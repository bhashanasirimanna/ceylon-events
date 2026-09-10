import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InternalAuthGuard, JwtAuthGuard } from "@ceylon/nest-common";
import { SeatMapsService } from "../seat-maps/seat-maps.service";
import { CreateHoldDto } from "./dto/create-hold.dto";
import { ReleaseHoldDto } from "./dto/release-hold.dto";
import { MarkSoldDto } from "./dto/mark-sold.dto";
import { HoldsService } from "./holds.service";

@Controller("seat-map-versions/:versionId")
export class SeatMapVersionsController {
  constructor(
    private readonly seatMapsService: SeatMapsService,
    private readonly holdsService: HoldsService,
  ) {}

  // Public: the frozen layout, used by the read-only seat picker.
  @Get()
  async getSnapshot(@Param("versionId") versionId: string) {
    const version = await this.seatMapsService.getVersionOrThrow(versionId);
    return version.snapshot;
  }

  // Public: per-seat AVAILABLE/HELD/HELD_BY_ME/SOLD status in one call.
  // `holderToken` is whatever the caller's browser is currently holding, so
  // its own held seats resolve to HELD_BY_ME rather than a generic HELD.
  @Get("availability")
  async getAvailability(
    @Param("versionId") versionId: string,
    @Query("holderToken") holderToken?: string,
  ) {
    const version = await this.seatMapsService.getVersionOrThrow(versionId);
    const seatIds = version.snapshot.tables.flatMap((t) =>
      t.seats.map((s) => s.id),
    );
    return this.holdsService.getAvailability(versionId, seatIds, holderToken);
  }

  @Post("holds")
  @UseGuards(JwtAuthGuard)
  async createHold(
    @Param("versionId") versionId: string,
    @Body() dto: CreateHoldDto,
  ) {
    await this.seatMapsService.getVersionOrThrow(versionId);
    return this.holdsService.createHold(versionId, dto.seatId);
  }

  @Post("holds/:seatId/renew")
  @UseGuards(JwtAuthGuard)
  async renewHold(
    @Param("versionId") versionId: string,
    @Param("seatId") seatId: string,
    @Body() dto: ReleaseHoldDto,
  ) {
    return this.holdsService.renewHold(versionId, seatId, dto.holderToken);
  }

  @Delete("holds/:seatId")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async releaseHold(
    @Param("versionId") versionId: string,
    @Param("seatId") seatId: string,
    @Body() dto: ReleaseHoldDto,
  ) {
    await this.holdsService.releaseHold(versionId, seatId, dto.holderToken);
  }

  // Called by the Payment Service once a payment actually confirms
  // (Phase 4). Service-to-service only — never called directly by a
  // buyer's browser.
  @Post("seats/:seatId/mark-sold")
  @UseGuards(InternalAuthGuard)
  async markSold(
    @Param("versionId") versionId: string,
    @Param("seatId") seatId: string,
    @Body() dto: MarkSoldDto,
  ) {
    await this.holdsService.markSold(versionId, seatId, dto.orderId);
  }
}
