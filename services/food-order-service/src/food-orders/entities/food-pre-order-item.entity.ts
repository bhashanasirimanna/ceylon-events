import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "food_pre_order_items" })
export class FoodPreOrderItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "food_pre_order_id", type: "uuid" })
  foodPreOrderId: string;

  @Column({ name: "menu_item_id", type: "uuid" })
  menuItemId: string;

  // Denormalized from the restaurant's menu at submission time, so a
  // later menu edit/rename doesn't retroactively change what the kitchen
  // sees for an already-placed pre-order.
  @Column({ name: "menu_item_name" })
  menuItemName: string;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  // Informational only — food pre-orders are never billed through the
  // platform, this is just so the buyer/restaurant can see the expected
  // at-venue cost.
  @Column({ name: "price_minor_units", type: "int" })
  priceMinorUnits: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
