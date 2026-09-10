import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "order_items" })
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @Column({ name: "ticket_tier_id", type: "uuid" })
  ticketTierId: string;

  // Null for unseated/general-admission tiers.
  @Column({ name: "seat_id", type: "uuid", nullable: true })
  seatId: string | null;

  // Denormalized from the venue-service seat-map-version snapshot at order
  // creation time, purely for display (e.g. "Table T1, Seat A2").
  @Column({ name: "seat_label", type: "varchar", nullable: true })
  seatLabel: string | null;

  // Snapshot of the tier's price at purchase time, so later tier price
  // changes don't retroactively change past orders.
  @Column({ name: "price_minor_units", type: "int" })
  priceMinorUnits: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
