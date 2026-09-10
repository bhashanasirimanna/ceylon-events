import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { JwtAccessPayload } from "@ceylon/shared-types";

/**
 * Like JwtAuthGuard, but never rejects the request when no/invalid token is
 * present — `request.user` is simply left undefined so public endpoints can
 * still branch on "am I an admin/owner" when a token happens to be sent.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  handleRequest<TUser = JwtAccessPayload>(
    _err: unknown,
    user: TUser | false,
  ): TUser {
    return (user || undefined) as TUser;
  }
}
