import { DiscountType, RedemptionType } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "offers" })
export class Offer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  // Denormalized from the event at creation time, for ownership checks
  // without a network round trip on every read.
  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "discount_type", type: "enum", enum: DiscountType })
  discountType: DiscountType;

  // Meaning depends on discountType: a 0-100 percentage, a fixed minor-unit
  // amount, or unused (0) for FREE_ITEM, where applicableMenuItemIds names
  // the free item(s) instead.
  @Column({ name: "discount_value", type: "int" })
  discountValue: number;

  @Column({ name: "redemption_type", type: "enum", enum: RedemptionType })
  redemptionType: RedemptionType;

  // Only meaningful when redemptionType is CAPPED. SINGLE_USE is treated
  // as an implicit cap of 1 in the service layer rather than duplicated
  // here.
  @Column({ name: "redemption_cap", type: "int", nullable: true })
  redemptionCap: number | null;

  @Column({
    name: "applicable_menu_category_id",
    type: "uuid",
    nullable: true,
  })
  applicableMenuCategoryId: string | null;

  @Column({
    name: "applicable_menu_item_ids",
    type: "text",
    array: true,
    nullable: true,
  })
  applicableMenuItemIds: string[] | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
