import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import ms from "ms";
import { Repository } from "typeorm";
import type {
  AuthTokens,
  JwtAccessPayload,
  JwtRefreshPayload,
} from "@ceylon/shared-types";
import { UserRole } from "@ceylon/shared-types";
import { RefreshToken } from "../users/entities/refresh-token.entity";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(params: {
    email: string;
    password: string;
    fullName: string;
  }): Promise<{ user: User; tokens: AuthTokens }> {
    const existing = await this.usersService.findByEmail(params.email);
    if (existing) {
      throw new ConflictException("Email is already registered");
    }
    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    const user = await this.usersService.createUser({
      email: params.email,
      passwordHash,
      fullName: params.fullName,
    });
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async login(params: {
    email: string;
    password: string;
  }): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await this.usersService.findByEmail(params.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const matches = await bcrypt.compare(params.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        { secret: this.configService.getOrThrow("JWT_REFRESH_SECRET") },
      );
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { id: payload.tokenId },
    });
    if (
      !stored ||
      stored.tokenHash !== tokenHash ||
      stored.revokedAt ||
      stored.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("User no longer active");
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepository.save(stored);

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        { secret: this.configService.getOrThrow("JWT_REFRESH_SECRET") },
      );
      await this.refreshTokenRepository.update(
        { id: payload.tokenId },
        { revokedAt: new Date() },
      );
    } catch {
      // Already invalid/expired — nothing to revoke.
    }
  }

  /**
   * Creates a restaurant staff/owner account scoped to one restaurant.
   * Notification Service (Phase 7) will email the temp password instead of
   * it being returned to the caller; until then it comes back in the
   * response so the inviting admin can hand it over out of band.
   */
  async inviteRestaurantStaff(params: {
    email: string;
    fullName: string;
    restaurantId: string;
    role: UserRole.RESTAURANT_OWNER | UserRole.RESTAURANT_STAFF;
  }): Promise<{ user: User; tempPassword: string }> {
    const existing = await this.usersService.findByEmail(params.email);
    if (existing) {
      throw new ConflictException("Email is already registered");
    }
    const tempPassword = randomUUID().slice(0, 12);
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
    const user = await this.usersService.createUser({
      email: params.email,
      passwordHash,
      fullName: params.fullName,
      roles: [params.role],
      restaurantId: params.restaurantId,
    });
    return { user, tempPassword };
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const accessTtl = this.configService.get<string>(
      "JWT_ACCESS_TTL",
      "900s",
    );
    const refreshTtl = this.configService.get<string>(
      "JWT_REFRESH_TTL",
      "30d",
    );

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles as UserRole[],
      restaurantId: user.restaurantId ?? undefined,
      type: "access",
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.getOrThrow("JWT_ACCESS_SECRET"),
      expiresIn: accessTtl,
    });

    const tokenId = randomUUID();
    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      tokenId,
      type: "refresh",
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.getOrThrow("JWT_REFRESH_SECRET"),
      expiresIn: refreshTtl,
    });

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        id: tokenId,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ms(refreshTtl)),
      }),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(ms(accessTtl) / 1000),
    };
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
