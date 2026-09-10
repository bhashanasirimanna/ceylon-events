import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { JwtAccessPayload } from "@ceylon/shared-types";

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtAccessPayload | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: JwtAccessPayload }>();
    return request.user;
  },
);
