import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderItem } from "./entities/order-item.entity";
import { Order } from "./entities/order.entity";
import { InternalOrdersController } from "./internal-orders.controller";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    HttpModule.register({ timeout: 5000 }),
  ],
  controllers: [OrdersController, InternalOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
