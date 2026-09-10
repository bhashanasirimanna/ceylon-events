import { Module, type DynamicModule } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";

@Module({})
export class AuthCommonModule {
  /**
   * Registers a passport JWT strategy verifying access tokens issued by the
   * Identity Service. Every downstream service verifies independently using
   * the shared JWT_ACCESS_SECRET rather than trusting gateway headers alone.
   */
  static forRoot(secret: string): DynamicModule {
    return {
      module: AuthCommonModule,
      imports: [PassportModule],
      providers: [
        {
          provide: JwtStrategy,
          useFactory: () => new JwtStrategy(secret),
        },
      ],
      exports: [PassportModule],
    };
  }
}
