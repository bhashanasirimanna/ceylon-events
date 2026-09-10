import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";

const INTERNAL_SECRET_HEADER = "x-internal-secret";

/**
 * Guards endpoints meant to be called only by other backend services
 * (e.g. Payment Service confirming an order, or marking a seat sold),
 * never directly by a browser client. Shares one secret across services
 * via INTERNAL_SERVICE_SECRET — good enough for this stage of the build;
 * a production deploy would swap this for mTLS or per-service credentials.
 */
@Injectable()
export class InternalAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[INTERNAL_SECRET_HEADER];
    const expected = process.env.INTERNAL_SERVICE_SECRET;
    if (!expected || provided !== expected) {
      throw new UnauthorizedException("Invalid internal service credentials");
    }
    return true;
  }
}
