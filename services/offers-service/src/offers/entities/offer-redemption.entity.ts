import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

// One row per time a ticket's offer was used at the venue — for UNLIMITED
// offers this is just an audit trail (never blocks); for CAPPED/SINGLE_USE
// it's what the redemption-count check counts against.
@Entity({ name: "offer_redemptions" })
export class OfferRedemption {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "offer_id", type: "uuid" })
  offerId: string;

  @Index()
  @Column({ name: "order_item_id", type: "uuid" })
  orderItemId: string;

  @Column({ name: "redeemed_by_user_id", type: "uuid" })
  redeemedByUserId: string;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: "redeemed_at" })
  redeemedAt: Date;
}
