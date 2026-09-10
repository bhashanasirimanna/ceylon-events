import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "refresh_tokens" })
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  // SHA-256 hash of the refresh token; the raw token is never persisted.
  @Column({ name: "token_hash" })
  tokenHash: string;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
