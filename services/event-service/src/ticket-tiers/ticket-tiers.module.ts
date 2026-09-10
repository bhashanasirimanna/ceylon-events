import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventsModule } from "../events/events.module";
import { TicketTier } from "./entities/ticket-tier.entity";
import { EventTicketTiersController } from "./event-ticket-tiers.controller";
import { TicketTiersController } from "./ticket-tiers.controller";
import { TicketTiersService } from "./ticket-tiers.service";

@Module({
  imports: [TypeOrmModule.forFeature([TicketTier]), EventsModule],
  controllers: [EventTicketTiersController, TicketTiersController],
  providers: [TicketTiersService],
})
export class TicketTiersModule {}
