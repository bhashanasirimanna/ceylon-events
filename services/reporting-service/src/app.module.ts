import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthCommonModule, HealthModule } from "@ceylon/nest-common";
import { ReportsModule } from "./reports/reports.module";

// No database of its own — this service is a stateless read-only
// aggregator over other services' already-authorized HTTP endpoints,
// forwarding the caller's own bearer token rather than duplicating a data
// model that already lives elsewhere (event-service, order-service,
// food-order-service, ratings-service).
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthCommonModule.forRoot(
      process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_me",
    ),
    HealthModule,
    ReportsModule,
  ],
})
export class AppModule {}
