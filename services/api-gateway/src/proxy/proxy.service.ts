import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import type { Request, Response } from "express";

const STRIPPED_REQUEST_HEADERS = new Set(["host", "content-length", "connection"]);
const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-length",
  "transfer-encoding",
  "connection",
]);

// Path prefix (first segment after /api/) -> env var carrying the
// upstream service's base URL. Add an entry here whenever a new service
// gains a public-facing route.
const ROUTES: Record<string, string | undefined> = {
  auth: process.env.IDENTITY_SERVICE_URL,
  restaurants: process.env.RESTAURANT_SERVICE_URL,
  "menu-items": process.env.RESTAURANT_SERVICE_URL,
  media: process.env.MEDIA_SERVICE_URL,
  "seat-maps": process.env.VENUE_SERVICE_URL,
  "seat-map-versions": process.env.VENUE_SERVICE_URL,
  sections: process.env.VENUE_SERVICE_URL,
  tables: process.env.VENUE_SERVICE_URL,
  seats: process.env.VENUE_SERVICE_URL,
  events: process.env.EVENT_SERVICE_URL,
  "ticket-tiers": process.env.EVENT_SERVICE_URL,
  orders: process.env.ORDER_SERVICE_URL,
  payments: process.env.PAYMENT_SERVICE_URL,
  tickets: process.env.CHECKIN_SERVICE_URL,
};

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly httpService: HttpService) {}

  async forward(req: Request, res: Response): Promise<void> {
    const strippedPath = req.originalUrl.replace(/^\/api/, "") || "/";
    const firstSegment = strippedPath.match(/^\/([^/?]+)/)?.[1];
    const upstreamBase = firstSegment ? ROUTES[firstSegment] : undefined;

    if (!upstreamBase) {
      res.status(404).json({
        statusCode: 404,
        message: `No upstream route configured for '${strippedPath}'`,
      });
      return;
    }

    const targetUrl = `${upstreamBase}${strippedPath}`;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined || STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
        continue;
      }
      headers[key] = Array.isArray(value) ? value.join(",") : value;
    }

    // PayHere's IPN webhook (and any other form-post upstream) sends
    // application/x-www-form-urlencoded; Express parses that into a plain
    // object, but axios's default transformer JSON-encodes plain objects
    // unless the content-type says otherwise. Re-serialize explicitly so
    // the outgoing request actually matches its own content-type header.
    const contentType = headers["content-type"] ?? "";
    let data: unknown = req.body;
    if (
      !BODYLESS_METHODS.has(req.method.toUpperCase()) &&
      contentType.includes("application/x-www-form-urlencoded") &&
      req.body &&
      typeof req.body === "object"
    ) {
      data = new URLSearchParams(
        req.body as Record<string, string>,
      ).toString();
    } else if (BODYLESS_METHODS.has(req.method.toUpperCase())) {
      data = undefined;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          url: targetUrl,
          method: req.method,
          headers,
          data,
          timeout: 15000,
          validateStatus: () => true,
        }),
      );

      for (const [key, value] of Object.entries(response.headers)) {
        if (value === undefined || STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
          continue;
        }
        res.setHeader(key, value as string | string[]);
      }
      res.status(response.status).send(response.data);
    } catch (error) {
      this.logger.warn(`Upstream request to ${targetUrl} failed: ${(error as Error).message}`);
      res.status(502).json({
        statusCode: 502,
        message: "Upstream service unavailable",
        error: (error as Error).message,
      });
    }
  }
}
