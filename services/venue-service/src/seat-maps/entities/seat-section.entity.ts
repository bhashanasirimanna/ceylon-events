import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "seat_sections" })
export class SeatSection {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "seat_map_id", type: "uuid" })
  seatMapId: string;

  @Column()
  name: string;

  @Column({ type: "float" })
  x: number;

  @Column({ type: "float" })
  y: number;

  @Column({ type: "float" })
  width: number;

  @Column({ type: "float" })
  height: number;

  @Column({ type: "varchar", nullable: true })
  color: string | null;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
