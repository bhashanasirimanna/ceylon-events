import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { SeatMapsService } from "./seat-maps.service";

// Public discovery endpoint, deliberately separate from the authoring
// routes under /seat-maps/:id (those require restaurant-owner/admin
// roles). Not nested under /restaurants/* — see restaurant-seat-maps
// .controller.ts for why that prefix is avoided at the gateway.
@Controller("seat-map-versions/by-restaurant")
export class PublicSeatMapsController {
  constructor(private readonly seatMapsService: SeatMapsService) {}

  @Get(":restaurantId/latest")
  async latest(@Param("restaurantId") restaurantId: string) {
    const version =
      await this.seatMapsService.getLatestPublishedVersionForRestaurant(
        restaurantId,
      );
    if (!version) {
      throw new NotFoundException(
        "This restaurant has no published seat map yet",
      );
    }
    return version;
  }
}
