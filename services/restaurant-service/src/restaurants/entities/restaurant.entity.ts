import { RestaurantStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "restaurants" })
export class Restaurant {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column()
  address: string;

  @Column({ name: "contact_email" })
  contactEmail: string;

  @Column({ name: "contact_phone", type: "varchar", nullable: true })
  contactPhone: string | null;

  @Column({ name: "cover_photo_url", type: "varchar", nullable: true })
  coverPhotoUrl: string | null;

  @Column({
    type: "enum",
    enum: RestaurantStatus,
    default: RestaurantStatus.PENDING,
  })
  status: RestaurantStatus;

  // Set once an owner account exists for this restaurant (created via the
  // Identity Service's invite-restaurant-staff flow). Cross-service
  // reference, not a foreign key.
  @Column({ name: "owner_user_id", type: "uuid", nullable: true })
  ownerUserId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
