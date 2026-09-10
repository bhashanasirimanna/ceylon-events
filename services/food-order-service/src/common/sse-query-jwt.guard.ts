import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { JwtAccessPayload } from "@ceylon/shared-types";

// Native EventSource can't set an Authorization header, so SSE endpoints
// accept the access token as a `?token=` query param instead — a common,
// accepted pattern for browser SSE. Everything else in this service still
// uses the normal Bearer-header JwtAuthGuard.
@Injectable()
export class SseQueryJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtAccessPayload }>();
    const token = request.query.token;
    if (typeof token !== "string" || !token) {
      throw new UnauthorizedException("Missing token query parameter");
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(
        token,
        { secret: process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_me" },
      );
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
