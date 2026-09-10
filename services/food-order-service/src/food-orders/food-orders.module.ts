import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FoodPreOrderItem } from "./entities/food-pre-order-item.entity";
import { FoodPreOrder } from "./entities/food-pre-order.entity";
import { FoodOrdersController } from "./food-orders.controller";
import { FoodOrdersService } from "./food-orders.service";
import { FoodOrdersRealtimeService } from "./realtime/food-orders-realtime.service";
import { SseQueryJwtGuard } from "../common/sse-query-jwt.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([FoodPreOrder, FoodPreOrderItem]),
    HttpModule.register({ timeout: 5000 }),
    JwtModule.register({}),
  ],
  controllers: [FoodOrdersController],
  providers: [FoodOrdersService, FoodOrdersRealtimeService, SseQueryJwtGuard],
})
export class FoodOrdersModule {}
