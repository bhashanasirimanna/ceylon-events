import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import type { ApiErrorBody } from "@ceylon/shared-types";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttp ? exception.getResponse() : undefined;
    const message =
      typeof body === "string"
        ? body
        : ((body as { message?: string | string[] })?.message ??
          (exception as Error)?.message ??
          "Internal server error");

    const payload: ApiErrorBody = {
      statusCode: status,
      message: Array.isArray(message) ? message.join(", ") : message,
      error: isHttp ? exception.name : "InternalServerError",
      correlationId: randomUUID(),
    };

    response.status(status).json(payload);
  }
}
