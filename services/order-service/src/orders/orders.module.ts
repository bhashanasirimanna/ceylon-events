import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PromoCodesModule } from "../promo-codes/promo-codes.module";
import { OrderItem } from "./entities/order-item.entity";
import { Order } from "./entities/order.entity";
import { InternalOrdersController } from "./internal-orders.controller";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    HttpModule.register({ timeout: 5000 }),
    PromoCodesModule,
  ],
  controllers: [OrdersController, InternalOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
