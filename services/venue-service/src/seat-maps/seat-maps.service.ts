import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type {
  JwtAccessPayload,
  SeatMapSnapshot,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { canManageRestaurant } from "../common/auth-helpers";
import { CreateSeatMapDto } from "./dto/create-seat-map.dto";
import { CreateSectionDto } from "./dto/create-section.dto";
import { CreateTableDto } from "./dto/create-table.dto";
import { BulkCreateSeatsDto } from "./dto/bulk-create-seats.dto";
import { UpdateSeatMapDto } from "./dto/update-seat-map.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";
import { UpdateTableDto } from "./dto/update-table.dto";
import { UpdateSeatDto } from "./dto/update-seat.dto";
import { SeatMap } from "./entities/seat-map.entity";
import { SeatMapVersion } from "./entities/seat-map-version.entity";
import { SeatSection } from "./entities/seat-section.entity";
import { SeatTable } from "./entities/seat-table.entity";
import { Seat } from "./entities/seat.entity";
import { SeatMapStatus } from "@ceylon/shared-types";

@Injectable()
export class SeatMapsService {
  constructor(
    @InjectRepository(SeatMap)
    private readonly seatMapsRepository: Repository<SeatMap>,
    @InjectRepository(SeatSection)
    private readonly sectionsRepository: Repository<SeatSection>,
    @InjectRepository(SeatTable)
    private readonly tablesRepository: Repository<SeatTable>,
    @InjectRepository(Seat)
    private readonly seatsRepository: Repository<Seat>,
    @InjectRepository(SeatMapVersion)
    private readonly versionsRepository: Repository<SeatMapVersion>,
  ) {}

  private async getSeatMapOrThrow(id: string): Promise<SeatMap> {
    const seatMap = await this.seatMapsRepository.findOne({ where: { id } });
    if (!seatMap) {
      throw new NotFoundException("Seat map not found");
    }
    return seatMap;
  }

  private assertCanManage(
    caller: JwtAccessPayload,
    restaurantId: string,
  ): void {
    if (!canManageRestaurant(caller, restaurantId)) {
      throw new ForbiddenException(
        "You may only manage seat maps for your own restaurant",
      );
    }
  }

  async createSeatMap(
    restaurantId: string,
    dto: CreateSeatMapDto,
    caller: JwtAccessPayload,
  ): Promise<SeatMap> {
    this.assertCanManage(caller, restaurantId);
    const seatMap = this.seatMapsRepository.create({
      restaurantId,
      name: dto.name,
      canvasWidth: dto.canvasWidth,
      canvasHeight: dto.canvasHeight,
    });
    return this.seatMapsRepository.save(seatMap);
  }

  async listByRestaurant(
    restaurantId: string,
    caller: JwtAccessPayload,
  ): Promise<SeatMap[]> {
    this.assertCanManage(caller, restaurantId);
    return this.seatMapsRepository.find({
      where: { restaurantId },
      order: { createdAt: "ASC" },
    });
  }

  async updateSeatMap(
    id: string,
    dto: UpdateSeatMapDto,
    caller: JwtAccessPayload,
  ): Promise<SeatMap> {
    const seatMap = await this.getSeatMapOrThrow(id);
    this.assertCanManage(caller, seatMap.restaurantId);
    Object.assign(seatMap, dto);
    return this.seatMapsRepository.save(seatMap);
  }

  async getFullDefinition(
    id: string,
    caller: JwtAccessPayload,
  ): Promise<{
    seatMap: SeatMap;
    sections: SeatSection[];
    tables: (SeatTable & { seats: Seat[] })[];
  }> {
    const seatMap = await this.getSeatMapOrThrow(id);
    this.assertCanManage(caller, seatMap.restaurantId);

    const [sections, tables, seats] = await Promise.all([
      this.sectionsRepository.find({
        where: { seatMapId: id },
        order: { sortOrder: "ASC" },
      }),
      this.tablesRepository.find({ where: { seatMapId: id } }),
      this.seatsRepository.find({ where: { seatMapId: id } }),
    ]);

    const tablesWithSeats = tables.map((table) => ({
      ...table,
      seats: seats.filter((seat) => seat.tableId === table.id),
    }));

    return { seatMap, sections, tables: tablesWithSeats };
  }

  async createSection(
    seatMapId: string,
    dto: CreateSectionDto,
    caller: JwtAccessPayload,
  ): Promise<SeatSection> {
    const seatMap = await this.getSeatMapOrThrow(seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    const section = this.sectionsRepository.create({
      seatMapId,
      name: dto.name,
      x: dto.x,
      y: dto.y,
      width: dto.width,
      height: dto.height,
      color: dto.color ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.sectionsRepository.save(section);
  }

  async updateSection(
    sectionId: string,
    dto: UpdateSectionDto,
    caller: JwtAccessPayload,
  ): Promise<SeatSection> {
    const section = await this.sectionsRepository.findOne({
      where: { id: sectionId },
    });
    if (!section) {
      throw new NotFoundException("Section not found");
    }
    const seatMap = await this.getSeatMapOrThrow(section.seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    Object.assign(section, dto);
    return this.sectionsRepository.save(section);
  }

  async deleteSection(
    sectionId: string,
    caller: JwtAccessPayload,
  ): Promise<void> {
    const section = await this.sectionsRepository.findOne({
      where: { id: sectionId },
    });
    if (!section) {
      throw new NotFoundException("Section not found");
    }
    const seatMap = await this.getSeatMapOrThrow(section.seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    // Tables in this section become unsectioned rather than being deleted.
    await this.tablesRepository.update(
      { sectionId },
      { sectionId: null },
    );
    await this.sectionsRepository.delete(sectionId);
  }

  async createTable(
    seatMapId: string,
    dto: CreateTableDto,
    caller: JwtAccessPayload,
  ): Promise<SeatTable> {
    const seatMap = await this.getSeatMapOrThrow(seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    const table = this.tablesRepository.create({
      seatMapId,
      sectionId: dto.sectionId ?? null,
      tableNumber: dto.tableNumber,
      x: dto.x,
      y: dto.y,
      shape: dto.shape,
      capacity: dto.capacity,
    });
    return this.tablesRepository.save(table);
  }

  async updateTable(
    tableId: string,
    dto: UpdateTableDto,
    caller: JwtAccessPayload,
  ): Promise<SeatTable> {
    const table = await this.tablesRepository.findOne({
      where: { id: tableId },
    });
    if (!table) {
      throw new NotFoundException("Table not found");
    }
    const seatMap = await this.getSeatMapOrThrow(table.seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    Object.assign(table, dto);
    return this.tablesRepository.save(table);
  }

  async deleteTable(tableId: string, caller: JwtAccessPayload): Promise<void> {
    const table = await this.tablesRepository.findOne({
      where: { id: tableId },
    });
    if (!table) {
      throw new NotFoundException("Table not found");
    }
    const seatMap = await this.getSeatMapOrThrow(table.seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    await this.seatsRepository.delete({ tableId });
    await this.tablesRepository.delete(tableId);
  }

  async bulkCreateSeats(
    tableId: string,
    dto: BulkCreateSeatsDto,
    caller: JwtAccessPayload,
  ): Promise<Seat[]> {
    const table = await this.tablesRepository.findOne({
      where: { id: tableId },
    });
    if (!table) {
      throw new NotFoundException("Table not found");
    }
    const seatMap = await this.getSeatMapOrThrow(table.seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);

    const seats = dto.seats.map((seatInput) =>
      this.seatsRepository.create({
        seatMapId: table.seatMapId,
        tableId,
        seatLabel: seatInput.seatLabel,
        x: seatInput.x,
        y: seatInput.y,
      }),
    );
    return this.seatsRepository.save(seats);
  }

  async updateSeat(
    seatId: string,
    dto: UpdateSeatDto,
    caller: JwtAccessPayload,
  ): Promise<Seat> {
    const seat = await this.seatsRepository.findOne({ where: { id: seatId } });
    if (!seat) {
      throw new NotFoundException("Seat not found");
    }
    const seatMap = await this.getSeatMapOrThrow(seat.seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    Object.assign(seat, dto);
    return this.seatsRepository.save(seat);
  }

  async deleteSeat(seatId: string, caller: JwtAccessPayload): Promise<void> {
    const seat = await this.seatsRepository.findOne({ where: { id: seatId } });
    if (!seat) {
      throw new NotFoundException("Seat not found");
    }
    const seatMap = await this.getSeatMapOrThrow(seat.seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    await this.seatsRepository.delete(seatId);
  }

  async publish(
    seatMapId: string,
    caller: JwtAccessPayload,
  ): Promise<SeatMapVersion> {
    const { seatMap, sections, tables } = await this.getFullDefinition(
      seatMapId,
      caller,
    );

    const snapshot: SeatMapSnapshot = {
      seatMapId: seatMap.id,
      restaurantId: seatMap.restaurantId,
      name: seatMap.name,
      canvasWidth: seatMap.canvasWidth,
      canvasHeight: seatMap.canvasHeight,
      sections: sections.map((s) => ({
        id: s.id,
        name: s.name,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        color: s.color,
        sortOrder: s.sortOrder,
      })),
      tables: tables.map((t) => ({
        id: t.id,
        sectionId: t.sectionId,
        tableNumber: t.tableNumber,
        x: t.x,
        y: t.y,
        shape: t.shape,
        capacity: t.capacity,
        seats: t.seats.map((seat) => ({
          id: seat.id,
          tableId: seat.tableId,
          seatLabel: seat.seatLabel,
          x: seat.x,
          y: seat.y,
        })),
      })),
    };

    const lastVersion = await this.versionsRepository.findOne({
      where: { seatMapId },
      order: { versionNumber: "DESC" },
    });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const version = this.versionsRepository.create({
      seatMapId,
      versionNumber,
      snapshot,
    });
    const saved = await this.versionsRepository.save(version);

    seatMap.status = SeatMapStatus.PUBLISHED;
    await this.seatMapsRepository.save(seatMap);

    return saved;
  }

  async listVersions(
    seatMapId: string,
    caller: JwtAccessPayload,
  ): Promise<SeatMapVersion[]> {
    const seatMap = await this.getSeatMapOrThrow(seatMapId);
    this.assertCanManage(caller, seatMap.restaurantId);
    return this.versionsRepository.find({
      where: { seatMapId },
      order: { versionNumber: "DESC" },
    });
  }

  async getVersionOrThrow(versionId: string): Promise<SeatMapVersion> {
    const version = await this.versionsRepository.findOne({
      where: { id: versionId },
    });
    if (!version) {
      throw new NotFoundException("Seat map version not found");
    }
    return version;
  }

  /**
   * Public discovery path: given only a restaurantId (no seat-map id, no
   * authoring permissions), find the most recently published version across
   * all of that restaurant's seat maps. Once the Event Service (Phase 3)
   * exists, events will carry their own seatMapVersionId directly instead
   * of relying on "latest" — this is a stand-in for the User Portal until
   * then.
   */
  async getLatestPublishedVersionForRestaurant(
    restaurantId: string,
  ): Promise<SeatMapVersion | null> {
    const seatMaps = await this.seatMapsRepository.find({
      where: { restaurantId },
    });
    if (seatMaps.length === 0) {
      return null;
    }
    const seatMapIds = seatMaps.map((s) => s.id);
    const versions = await this.versionsRepository
      .createQueryBuilder("version")
      .where("version.seat_map_id IN (:...seatMapIds)", { seatMapIds })
      .orderBy("version.published_at", "DESC")
      .limit(1)
      .getMany();
    return versions[0] ?? null;
  }
}
