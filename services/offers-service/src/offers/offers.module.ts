import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OfferRedemption } from "./entities/offer-redemption.entity";
import { OfferTicketTier } from "./entities/offer-ticket-tier.entity";
import { Offer } from "./entities/offer.entity";
import { OffersController } from "./offers.controller";
import { OffersService } from "./offers.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Offer, OfferTicketTier, OfferRedemption]),
    HttpModule.register({ timeout: 5000 }),
  ],
  controllers: [OffersController],
  providers: [OffersService],
})
export class OffersModule {}
