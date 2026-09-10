import { DietaryTag } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "menu_items" })
export class MenuItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Index()
  @Column({ name: "category_id", type: "uuid" })
  categoryId: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "price_minor_units", type: "int" })
  priceMinorUnits: number;

  @Column({ default: "LKR" })
  currency: string;

  @Column({
    name: "dietary_tags",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  dietaryTags: DietaryTag[];

  @Column({ name: "is_available", default: true })
  isAvailable: boolean;

  @Column({
    name: "photo_urls",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  photoUrls: string[];

  // Denormalized from the Rating Service (Phase 7); null until any ratings
  // exist for this item.
  @Column({
    name: "avg_rating",
    type: "float",
    nullable: true,
    default: null,
  })
  avgRating: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
