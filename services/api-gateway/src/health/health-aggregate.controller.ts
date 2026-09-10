import { Controller, Get } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

type ServiceStatus = "ok" | "down";

@Controller("health")
export class HealthAggregateController {
  constructor(private readonly httpService: HttpService) {}

  @Get("all")
  async all(): Promise<{ gateway: "ok"; services: Record<string, ServiceStatus> }> {
    const targets: Record<string, string | undefined> = {
      identity: process.env.IDENTITY_SERVICE_URL,
      restaurant: process.env.RESTAURANT_SERVICE_URL,
      media: process.env.MEDIA_SERVICE_URL,
      venue: process.env.VENUE_SERVICE_URL,
      event: process.env.EVENT_SERVICE_URL,
      order: process.env.ORDER_SERVICE_URL,
      payment: process.env.PAYMENT_SERVICE_URL,
      checkin: process.env.CHECKIN_SERVICE_URL,
      foodOrder: process.env.FOOD_ORDER_SERVICE_URL,
      offers: process.env.OFFERS_SERVICE_URL,
    };

    const checks = await Promise.allSettled(
      Object.entries(targets).map(
        async ([name, baseUrl]): Promise<[string, ServiceStatus]> => {
          if (!baseUrl) {
            return [name, "down"];
          }
          try {
            await firstValueFrom(
              this.httpService.get(`${baseUrl}/health`, { timeout: 3000 }),
            );
            return [name, "ok"];
          } catch {
            return [name, "down"];
          }
        },
      ),
    );

    const services: Record<string, ServiceStatus> = {};
    for (const check of checks) {
      if (check.status === "fulfilled") {
        const [name, status] = check.value;
        services[name] = status;
      }
    }

    return { gateway: "ok", services };
  }
}
