import { PaymentMethod, PaymentStatus } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

// One Payment per order — created lazily the first time the buyer either
// initiates a PayHere checkout or submits a payment-proof for that order.
@Entity({ name: "payments" })
@Unique(["orderId"])
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @Index()
  @Column({ name: "buyer_id", type: "uuid" })
  buyerId: string;

  @Column({ name: "amount_minor_units", type: "int" })
  amountMinorUnits: number;

  @Column({ default: "LKR" })
  currency: string;

  @Column({ type: "enum", enum: PaymentMethod })
  method: PaymentMethod;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // PayHere's own transaction id from the IPN callback, once known.
  @Column({ name: "payhere_payment_id", type: "varchar", nullable: true })
  payherePaymentId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
