import { PaymentStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

// Audit trail of every proof a buyer has submitted for a payment — a
// rejected proof doesn't get overwritten, the buyer submits a new one and
// both remain visible to admins reviewing the order's history.
@Entity({ name: "payment_proofs" })
export class PaymentProof {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "payment_id", type: "uuid" })
  paymentId: string;

  @Index()
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @Column({ name: "object_key" })
  objectKey: string;

  @Column({ name: "public_url" })
  publicUrl: string;

  @Column({ name: "reference_note", type: "text" })
  referenceNote: string;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ name: "reviewed_by_user_id", type: "uuid", nullable: true })
  reviewedByUserId: string | null;

  @Column({ name: "reviewed_at", type: "timestamptz", nullable: true })
  reviewedAt: Date | null;

  @Column({ name: "review_notes", type: "text", nullable: true })
  reviewNotes: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
