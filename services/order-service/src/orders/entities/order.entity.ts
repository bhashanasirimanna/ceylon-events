import { OrderStatus, PaymentMethod } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "buyer_id", type: "uuid" })
  buyerId: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // Sum of the order items' priceMinorUnits before any promo-code
  // discount is applied. Defaults to 0 purely so adding this column to an
  // already-populated table doesn't require a backfill migration —
  // every order created after this column existed always sets it
  // explicitly.
  @Column({ name: "subtotal_minor_units", type: "int", default: 0 })
  subtotalMinorUnits: number;

  @Column({ name: "discount_minor_units", type: "int", default: 0 })
  discountMinorUnits: number;

  // subtotalMinorUnits - discountMinorUnits. What the buyer actually owes.
  @Column({ name: "total_minor_units", type: "int" })
  totalMinorUnits: number;

  @Column({ name: "promo_code_id", type: "uuid", nullable: true })
  promoCodeId: string | null;

  @Column({ default: "LKR" })
  currency: string;

  @Column({ name: "payment_method", type: "enum", enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
