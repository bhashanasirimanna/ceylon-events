import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SoldSeat } from "../seat-maps/entities/sold-seat.entity";
import { SeatMapsModule } from "../seat-maps/seat-maps.module";
import { SeatMapVersionsController } from "./seat-map-versions.controller";
import { HoldsService } from "./holds.service";
import { redisProvider } from "./redis.provider";

@Module({
  imports: [TypeOrmModule.forFeature([SoldSeat]), SeatMapsModule],
  controllers: [SeatMapVersionsController],
  providers: [HoldsService, redisProvider],
})
export class HoldsModule {}
