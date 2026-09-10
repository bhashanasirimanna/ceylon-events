import { SeatMapStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "seat_maps" })
export class SeatMap {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "restaurant_id", type: "uuid" })
  restaurantId: string;

  @Column()
  name: string;

  @Column({ name: "canvas_width", type: "int", default: 1200 })
  canvasWidth: number;

  @Column({ name: "canvas_height", type: "int", default: 800 })
  canvasHeight: number;

  @Column({
    type: "enum",
    enum: SeatMapStatus,
    default: SeatMapStatus.DRAFT,
  })
  status: SeatMapStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
