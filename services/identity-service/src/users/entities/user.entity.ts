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

  // Set only while a restaurant-owner invite is pending (see
  // AuthService.inviteRestaurantOwner) — the account exists but isActive
  // is false and passwordHash is an unusable placeholder until the
  // invitee visits the link and sets their own password via
  // POST /auth/accept-invite, which clears both these columns. Postgres
  // doesn't treat NULLs as duplicates under a unique index, so every
  // already-activated user (inviteToken: null) coexists fine.
  @Index({ unique: true })
  @Column({ name: "invite_token", type: "varchar", nullable: true })
  inviteToken: string | null;

  @Column({
    name: "invite_token_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  inviteTokenExpiresAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
