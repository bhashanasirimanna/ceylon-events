import { DiscountType } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "promo_codes" })
@Unique(["eventId", "code"])
export class PromoCode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  // Stored/compared uppercase so lookups are case-insensitive without a
  // functional index.
  @Column()
  code: string;

  @Column({ name: "discount_type", type: "enum", enum: DiscountType })
  discountType: DiscountType;

  // A 0-100 percentage, or a fixed minor-unit amount, depending on
  // discountType.
  @Column({ name: "discount_value", type: "int" })
  discountValue: number;

  // Null = applies to the whole order; set = only discounts line items
  // for that specific ticket tier ("per-product" per the spec).
  @Column({
    name: "applicable_ticket_tier_id",
    type: "uuid",
    nullable: true,
  })
  applicableTicketTierId: string | null;

  @Column({ name: "usage_limit", type: "int", nullable: true })
  usageLimit: number | null;

  @Column({ name: "usage_count", type: "int", default: 0 })
  usageCount: number;

  @Column({ name: "expires_at", type: "timestamptz", nullable: true })
  expiresAt: Date | null;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
