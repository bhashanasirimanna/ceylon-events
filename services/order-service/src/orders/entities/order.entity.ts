import { OrderStatus, PaymentMethod } from "@ceylon/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ name: "buyer_id", type: "uuid" })
  buyerId: string;

  @Index()
  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ name: "total_minor_units", type: "int" })
  totalMinorUnits: number;

  @Column({ default: "LKR" })
  currency: string;

  @Column({ name: "payment_method", type: "enum", enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
