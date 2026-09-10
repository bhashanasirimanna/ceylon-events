import { z } from "zod";

export const billingDetailsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1).default("Sri Lanka"),
});
export type BillingDetails = z.infer<typeof billingDetailsSchema>;

export const initiatePaymentSchema = z.object({
  orderId: z.string().uuid(),
  billing: billingDetailsSchema,
});
export type InitiatePaymentDto = z.infer<typeof initiatePaymentSchema>;

export const submitPaymentProofSchema = z.object({
  objectKey: z.string().min(1),
  publicUrl: z.string().min(1),
  referenceNote: z.string().min(1),
});
export type SubmitPaymentProofDto = z.infer<typeof submitPaymentProofSchema>;

export const reviewPaymentProofSchema = z.object({
  notes: z.string().optional(),
});
export type ReviewPaymentProofDto = z.infer<typeof reviewPaymentProofSchema>;

// What the frontend actually submits a <form> POST to PayHere's checkout
// URL with — every field becomes a hidden input.
export interface PayHereCheckoutParams {
  action: string;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: string;
  amount: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  hash: string;
}
