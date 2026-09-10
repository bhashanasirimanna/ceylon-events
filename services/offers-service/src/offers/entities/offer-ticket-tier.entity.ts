import { Entity, Index, PrimaryGeneratedColumn, Column, Unique } from "typeorm";

// Join row: which ticket tiers a given offer is bundled with.
@Entity({ name: "offer_ticket_tiers" })
@Unique(["offerId", "ticketTierId"])
export class OfferTicketTier {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "offer_id", type: "uuid" })
  offerId: string;

  @Index()
  @Column({ name: "ticket_tier_id", type: "uuid" })
  ticketTierId: string;
}
