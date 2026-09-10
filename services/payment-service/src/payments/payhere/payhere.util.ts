import { createHash } from "node:crypto";

function md5Upper(input: string): string {
  return createHash("md5").update(input).digest("hex").toUpperCase();
}

/** Formats minor units (e.g. cents) the way PayHere expects: "1500.00". */
export function formatPayHereAmount(amountMinorUnits: number): string {
  return (amountMinorUnits / 100).toFixed(2);
}

/**
 * The hash PayHere's checkout form requires, proving this request actually
 * came from us and wasn't tampered with in the browser before submission.
 * https://support.payhere.lk/api-&-mobile-sdk/checkout-hash-generation
 */
export function computeCheckoutHash(params: {
  merchantId: string;
  merchantSecret: string;
  orderId: string;
  amountMinorUnits: number;
  currency: string;
}): string {
  const secretHash = md5Upper(params.merchantSecret);
  const amount = formatPayHereAmount(params.amountMinorUnits);
  return md5Upper(
    `${params.merchantId}${params.orderId}${amount}${params.currency}${secretHash}`,
  );
}

/**
 * The signature PayHere attaches to every IPN (webhook) notification.
 * Verifying it proves the notification genuinely came from PayHere and its
 * fields weren't forged by a third party hitting our public webhook URL.
 */
export function verifyIpnSignature(params: {
  merchantId: string;
  merchantSecret: string;
  orderId: string;
  payhereAmount: string;
  payhereCurrency: string;
  statusCode: string;
  receivedSignature: string;
}): boolean {
  const secretHash = md5Upper(params.merchantSecret);
  const expected = md5Upper(
    `${params.merchantId}${params.orderId}${params.payhereAmount}${params.payhereCurrency}${params.statusCode}${secretHash}`,
  );
  return expected === params.receivedSignature.toUpperCase();
}

export enum PayHereStatusCode {
  SUCCESS = "2",
  PENDING = "0",
  CANCELLED = "-1",
  FAILED = "-2",
  CHARGED_BACK = "-3",
}
