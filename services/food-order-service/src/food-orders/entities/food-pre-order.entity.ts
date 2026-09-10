import { FoodOrderStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

// One per ticket (order item) — the "line items" (menu selections) live on
// FoodPreOrderItem. orderItemId is unique: a ticket has at most one food
// pre-order, submitting again replaces its items rather than creating a
// second one.
@Entity({ name: "food_pre_orders" })
@Unique(["orderItemId"])
export class FoodPreOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @Column({ name: "order_item_id", type: "uuid" })
  orderItemId: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column({ name: "buyer_id", type: "uuid" })
  buyerId: string;

  @Column({ name: "seat_id", type: "uuid", nullable: true })
  seatId: string | null;

  @Column({ name: "seat_label", type: "varchar", nullable: true })
  seatLabel: string | null;

  // Denormalized from the venue-service seat-map snapshot at submission
  // time. Null for general-admission tickets — those group under a
  // synthetic "General Admission" bucket in the restaurant dashboard
  // rather than a real table.
  @Column({ name: "table_number", type: "varchar", nullable: true })
  tableNumber: string | null;

  @Column({
    type: "enum",
    enum: FoodOrderStatus,
    default: FoodOrderStatus.RECEIVED,
  })
  status: FoodOrderStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
