import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthCommonModule } from "@ceylon/nest-common";
import { RefreshToken } from "../users/entities/refresh-token.entity";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([RefreshToken]),
    JwtModule.register({}),
    // Env vars are populated by Docker/Compose before the process starts,
    // so reading process.env directly here (outside ConfigService) is safe.
    AuthCommonModule.forRoot(
      process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_me",
    ),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
