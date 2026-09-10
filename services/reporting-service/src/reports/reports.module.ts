import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [HttpModule.register({ timeout: 5000 })],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
