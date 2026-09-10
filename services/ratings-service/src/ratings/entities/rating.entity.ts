import { RatingSubjectType } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

// One rating per buyer per order per subject — a buyer can rate the event
// itself AND separately rate each menu item they pre-ordered, but can't
// double-rate the same subject on the same order.
@Entity({ name: "ratings" })
@Unique(["buyerId", "orderId", "subjectType", "subjectId"])
export class Rating {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "buyer_id", type: "uuid" })
  buyerId: string;

  @Index()
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column({ name: "subject_type", type: "enum", enum: RatingSubjectType })
  subjectType: RatingSubjectType;

  // The event's own id when subjectType is EVENT, or a menuItemId when
  // subjectType is MENU_ITEM.
  @Index()
  @Column({ name: "subject_id", type: "uuid" })
  subjectId: string;

  @Column({ type: "int" })
  stars: number;

  @Column({ type: "text", nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
