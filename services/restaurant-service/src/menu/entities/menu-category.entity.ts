import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "menu_categories" })
export class MenuCategory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column()
  name: string;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
