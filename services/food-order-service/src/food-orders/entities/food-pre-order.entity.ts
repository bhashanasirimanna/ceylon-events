import { FoodOrderSource, FoodOrderStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

// A food order for a table — either a guest's own pre-order against their
// ticket (source = PRE_ORDER) or an order a waiter places at the table
// directly (source = WAITER). Both share the exact same table identity
// and dashboard grouping; only their origin and a handful of
// origin-specific columns differ. orderId/orderItemId/buyerId are
// therefore nullable — a WAITER order has none of those, only a table.
//
// orderItemId keeps its unique constraint (a ticket has at most one
// pre-order — submitting again replaces its items) — Postgres treats
// multiple NULLs as distinct under a unique index, so this is unaffected
// by WAITER rows, which always have a null orderItemId.
@Entity({ name: "food_pre_orders" })
@Unique(["orderItemId"])
export class FoodPreOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "order_id", type: "uuid", nullable: true })
  orderId: string | null;

  @Column({ name: "order_item_id", type: "uuid", nullable: true })
  orderItemId: string | null;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column({ name: "buyer_id", type: "uuid", nullable: true })
  buyerId: string | null;

  @Column({ name: "seat_id", type: "uuid", nullable: true })
  seatId: string | null;

  @Column({ name: "seat_label", type: "varchar", nullable: true })
  seatLabel: string | null;

  // Authoritative table identity (FK into venue-service's table, cross-
  // service reference only — no DB-level relation). This is the real
  // grouping key; tableNumber below is display-only.
  @Index()
  @Column({ name: "table_id", type: "uuid", nullable: true })
  tableId: string | null;

  // Denormalized from the venue-service seat-map snapshot at submission
  // time, purely for display. Null for general-admission tickets — those
  // group under a synthetic "General Admission" bucket in the restaurant
  // dashboard rather than a real table.
  @Column({ name: "table_number", type: "varchar", nullable: true })
  tableNumber: string | null;

  @Column({
    type: "enum",
    enum: FoodOrderStatus,
    default: FoodOrderStatus.RECEIVED,
  })
  status: FoodOrderStatus;

  @Column({
    type: "enum",
    enum: FoodOrderSource,
    default: FoodOrderSource.PRE_ORDER,
  })
  source: FoodOrderSource;

  // Set only for WAITER-sourced orders — the authenticated staff member
  // who created it. Never accepted from the request body.
  @Column({ name: "created_by_user_id", type: "uuid", nullable: true })
  createdByUserId: string | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  // Idempotency key for waiter-order creation only — a double-tapped
  // "Place order" resubmits the same key and gets the original order back
  // rather than creating a duplicate. Nullable+unique, same reasoning as
  // orderItemId above: multiple NULLs (every PRE_ORDER row) are fine.
  @Index({ unique: true })
  @Column({ name: "client_request_id", type: "varchar", nullable: true })
  clientRequestId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
