import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { JwtAccessPayload } from "@ceylon/shared-types";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = JwtAccessPayload>(
    _err: unknown,
    user: TUser | false,
  ): TUser {
    return (user || undefined) as TUser;
  }
}
