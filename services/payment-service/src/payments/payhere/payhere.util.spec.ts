import {
  computeCheckoutHash,
  formatPayHereAmount,
  verifyIpnSignature,
} from "./payhere.util";

describe("formatPayHereAmount", () => {
  it("converts minor units to a two-decimal major-unit string", () => {
    expect(formatPayHereAmount(150000)).toBe("1500.00");
    expect(formatPayHereAmount(99)).toBe("0.99");
    expect(formatPayHereAmount(0)).toBe("0.00");
  });
});

const params = {
  merchantId: "TESTMERCHANT001",
  merchantSecret: "test-secret-value",
  orderId: "order-123",
  amountMinorUnits: 150000,
  currency: "LKR",
};

describe("computeCheckoutHash", () => {
  it("matches PayHere's documented hash algorithm for a known input", () => {
    // Known-good vector, computed independently via the same
    // MD5(merchantId + orderId + amount + currency + MD5(secret).toUpperCase())
    // formula PayHere's own docs specify.
    expect(computeCheckoutHash(params)).toBe(
      "1631FD918ACBEB55A34C6313340F15C3",
    );
  });

  it("changes when the amount changes", () => {
    const original = computeCheckoutHash(params);
    const tampered = computeCheckoutHash({ ...params, amountMinorUnits: 150001 });
    expect(tampered).not.toBe(original);
  });

  it("changes when the merchant secret changes", () => {
    const original = computeCheckoutHash(params);
    const withDifferentSecret = computeCheckoutHash({
      ...params,
      merchantSecret: "a-different-secret",
    });
    expect(withDifferentSecret).not.toBe(original);
  });
});

describe("verifyIpnSignature", () => {
  const ipnParams = {
    merchantId: params.merchantId,
    merchantSecret: params.merchantSecret,
    orderId: params.orderId,
    payhereAmount: "1500.00",
    payhereCurrency: "LKR",
    statusCode: "2",
  };
  const validSignature = "1D13811A27323E6C562AB0FCDB9C20BD";

  it("accepts a correctly signed IPN", () => {
    expect(
      verifyIpnSignature({ ...ipnParams, receivedSignature: validSignature }),
    ).toBe(true);
  });

  it("accepts a lowercase signature (PayHere's docs don't guarantee case)", () => {
    expect(
      verifyIpnSignature({
        ...ipnParams,
        receivedSignature: validSignature.toLowerCase(),
      }),
    ).toBe(true);
  });

  it("rejects a forged signature", () => {
    expect(
      verifyIpnSignature({ ...ipnParams, receivedSignature: "0".repeat(32) }),
    ).toBe(false);
  });

  it("rejects a signature computed for a different status code", () => {
    // A forged IPN claiming success but signed for a "pending" webhook.
    expect(
      verifyIpnSignature({
        ...ipnParams,
        statusCode: "0",
        receivedSignature: validSignature,
      }),
    ).toBe(false);
  });

  it("rejects a signature computed for a different amount", () => {
    expect(
      verifyIpnSignature({
        ...ipnParams,
        payhereAmount: "1.00",
        receivedSignature: validSignature,
      }),
    ).toBe(false);
  });
});
