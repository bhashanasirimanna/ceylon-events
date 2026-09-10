import { TicketStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

// Lazily created the first time a buyer (or admin) views their order's
// tickets, once that order is CONFIRMED. orderItemId is unique so lazy
// generation is idempotent/race-safe via the DB constraint rather than an
// application-level lock.
@Entity({ name: "tickets" })
@Unique(["orderItemId"])
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @Column({ name: "order_item_id", type: "uuid" })
  orderItemId: string;

  @Column({ name: "buyer_id", type: "uuid" })
  buyerId: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Column({ name: "ticket_tier_id", type: "uuid" })
  ticketTierId: string;

  @Column({ name: "seat_id", type: "uuid", nullable: true })
  seatId: string | null;

  @Column({ name: "seat_label", type: "varchar", nullable: true })
  seatLabel: string | null;

  // Opaque token encoded in the QR image and looked up at the door —
  // deliberately not this row's own id, so a leaked/guessed sequential id
  // can never be used to forge a check-in.
  @Index({ unique: true })
  @Column({ name: "qr_token" })
  qrToken: string;

  @Column({
    type: "enum",
    enum: TicketStatus,
    default: TicketStatus.ISSUED,
  })
  status: TicketStatus;

  @Column({ name: "checked_in_at", type: "timestamptz", nullable: true })
  checkedInAt: Date | null;

  @Column({ name: "checked_in_by_user_id", type: "uuid", nullable: true })
  checkedInByUserId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
