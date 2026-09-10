import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Rating } from "./entities/rating.entity";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";

@Module({
  imports: [TypeOrmModule.forFeature([Rating]), HttpModule.register({ timeout: 5000 })],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
