import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

// Permanent record that a seat within a published seat map version has been
// sold. Populated by this service's mark-sold endpoint, which the
// Order/Ticketing Service (Phase 3) will call once payment is confirmed.
@Entity({ name: "sold_seats" })
@Unique(["seatMapVersionId", "seatId"])
export class SoldSeat {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "seat_map_version_id", type: "uuid" })
  seatMapVersionId: string;

  @Index()
  @Column({ name: "seat_id", type: "uuid" })
  seatId: string;

  @Column({ name: "order_id", type: "uuid", nullable: true })
  orderId: string | null;

  @CreateDateColumn({ name: "sold_at" })
  soldAt: Date;
}
