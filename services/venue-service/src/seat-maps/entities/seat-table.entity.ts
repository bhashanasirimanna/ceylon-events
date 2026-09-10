import { TableShape } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "seat_tables" })
export class SeatTable {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "seat_map_id", type: "uuid" })
  seatMapId: string;

  @Index()
  @Column({ name: "section_id", type: "uuid", nullable: true })
  sectionId: string | null;

  @Column({ name: "table_number" })
  tableNumber: string;

  @Column({ type: "float" })
  x: number;

  @Column({ type: "float" })
  y: number;

  @Column({ type: "enum", enum: TableShape, default: TableShape.RECT })
  shape: TableShape;

  @Column({ type: "int" })
  capacity: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
