import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "seats" })
export class Seat {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "seat_map_id", type: "uuid" })
  seatMapId: string;

  @Index()
  @Column({ name: "table_id", type: "uuid" })
  tableId: string;

  @Column({ name: "seat_label" })
  seatLabel: string;

  @Column({ type: "float" })
  x: number;

  @Column({ type: "float" })
  y: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
