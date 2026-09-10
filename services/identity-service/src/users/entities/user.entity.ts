import { UserRole } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ name: "password_hash" })
  passwordHash: string;

  @Column({ name: "full_name" })
  fullName: string;

  @Column({ type: "text", array: true, default: () => "'{CUSTOMER}'" })
  roles: UserRole[];

  // Set when the user is a RESTAURANT_OWNER/RESTAURANT_STAFF; scopes them
  // to a single restaurant. Cross-service reference, not a foreign key.
  @Column({ name: "restaurant_id", type: "uuid", nullable: true })
  restaurantId: string | null;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
