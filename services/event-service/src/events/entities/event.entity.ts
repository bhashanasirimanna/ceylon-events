import { EventStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "events" })
export class Event {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  // Immutable published seat-map version this event sells seats against.
  // Null for events without assigned seating (general admission only).
  @Column({ name: "seat_map_version_id", type: "uuid", nullable: true })
  seatMapVersionId: string | null;

  @Column()
  title: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "banner_image_url", type: "varchar", nullable: true })
  bannerImageUrl: string | null;

  @Index()
  @Column({ name: "starts_at", type: "timestamptz" })
  startsAt: Date;

  @Column({
    type: "enum",
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status: EventStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
