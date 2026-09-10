import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PromoCode } from "./entities/promo-code.entity";
import { PromoCodesController } from "./promo-codes.controller";
import { PromoCodesService } from "./promo-codes.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([PromoCode]),
    HttpModule.register({ timeout: 5000 }),
  ],
  controllers: [PromoCodesController],
  providers: [PromoCodesService],
  exports: [PromoCodesService],
})
export class PromoCodesModule {}
