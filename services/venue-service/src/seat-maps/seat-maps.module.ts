import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SeatMap } from "./entities/seat-map.entity";
import { SeatMapVersion } from "./entities/seat-map-version.entity";
import { SeatSection } from "./entities/seat-section.entity";
import { SeatTable } from "./entities/seat-table.entity";
import { Seat } from "./entities/seat.entity";
import { SoldSeat } from "./entities/sold-seat.entity";
import { RestaurantSeatMapsController } from "./restaurant-seat-maps.controller";
import { PublicSeatMapsController } from "./public-seat-maps.controller";
import { SeatMapsController } from "./seat-maps.controller";
import { SectionsController } from "./sections.controller";
import { TablesController } from "./tables.controller";
import { SeatsController } from "./seats.controller";
import { SeatMapsService } from "./seat-maps.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SeatMap,
      SeatMapVersion,
      SeatSection,
      SeatTable,
      Seat,
      SoldSeat,
    ]),
  ],
  controllers: [
    RestaurantSeatMapsController,
    PublicSeatMapsController,
    SeatMapsController,
    SectionsController,
    TablesController,
    SeatsController,
  ],
  providers: [SeatMapsService],
  exports: [SeatMapsService, TypeOrmModule],
})
export class SeatMapsModule {}
