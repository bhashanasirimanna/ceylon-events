import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { HealthAggregateController } from "./health-aggregate.controller";

@Module({
  imports: [HttpModule],
  controllers: [HealthAggregateController],
})
export class HealthAggregateModule {}
