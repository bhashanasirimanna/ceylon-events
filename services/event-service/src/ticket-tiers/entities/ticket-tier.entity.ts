import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "ticket_tiers" })
export class TicketTier {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Column()
  name: string;

  @Column({ name: "price_minor_units", type: "int" })
  priceMinorUnits: number;

  @Column({ default: "LKR" })
  currency: string;

  @Column({ name: "sale_start_at", type: "timestamptz", nullable: true })
  saleStartAt: Date | null;

  @Column({ name: "sale_end_at", type: "timestamptz", nullable: true })
  saleEndAt: Date | null;

  // Restricts this tier to specific seat-map sections (e.g. a VIP tier
  // only sellable for the VIP section). Null/empty = any section. Informational
  // in this phase — not yet enforced server-side at order creation, see
  // order-service's known-limitations comment.
  @Column({
    name: "allowed_section_ids",
    type: "text",
    array: true,
    nullable: true,
  })
  allowedSectionIds: string[] | null;

  // Hard cap for unseated/general-admission tiers. Null = unlimited (or,
  // for seated tiers, bounded only by the seat map's actual seat count).
  @Column({ name: "quantity_limit", type: "int", nullable: true })
  quantityLimit: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
