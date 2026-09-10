import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthCommonModule, HealthModule } from "@ceylon/nest-common";
import { OffersModule } from "./offers/offers.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "postgres",
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== "production",
    }),
    AuthCommonModule.forRoot(
      process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_me",
    ),
    HealthModule,
    OffersModule,
  ],
})
export class AppModule {}
