import type { SeatMapSnapshot } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

// An immutable snapshot of a SeatMap at the moment it was published. Events
// (Phase 3) reference a specific version so that editing the live seat map
// later never changes the seating layout of an already-published event.
@Entity({ name: "seat_map_versions" })
export class SeatMapVersion {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "seat_map_id", type: "uuid" })
  seatMapId: string;

  @Column({ name: "version_number", type: "int" })
  versionNumber: number;

  @Column({ type: "jsonb" })
  snapshot: SeatMapSnapshot;

  @CreateDateColumn({ name: "published_at" })
  publishedAt: Date;
}
