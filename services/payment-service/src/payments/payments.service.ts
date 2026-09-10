import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectRepository } from "@nestjs/typeorm";
import { firstValueFrom } from "rxjs";
import { isAxiosError } from "axios";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type JwtAccessPayload,
  type PaginatedResult,
} from "@ceylon/shared-types";
import { Repository } from "typeorm";
import { isPlatformAdmin } from "../common/auth-helpers";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { PayHereIpnDto } from "./dto/payhere-ipn.dto";
import { SubmitPaymentProofDto } from "./dto/submit-payment-proof.dto";
import { ReviewPaymentProofDto } from "./dto/review-payment-proof.dto";
import { Payment } from "./entities/payment.entity";
import { PaymentProof } from "./entities/payment-proof.entity";
import {
  computeCheckoutHash,
  formatPayHereAmount,
  verifyIpnSignature,
} from "./payhere/payhere.util";
import type { UpstreamEvent, UpstreamOrder } from "./upstream-types";

const HTTP_TIMEOUT_MS = 5000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  private readonly orderServiceUrl = process.env.ORDER_SERVICE_URL;
  private readonly venueServiceUrl = process.env.VENUE_SERVICE_URL;
  private readonly eventServiceUrl = process.env.EVENT_SERVICE_URL;
  private readonly internalSecret = process.env.INTERNAL_SERVICE_SECRET ?? "";

  private readonly merchantId = process.env.PAYHERE_MERCHANT_ID ?? "";
  private readonly merchantSecret = process.env.PAYHERE_MERCHANT_SECRET ?? "";
  private readonly checkoutUrl =
    process.env.PAYHERE_CHECKOUT_URL ??
    "https://sandbox.payhere.lk/pay/checkout";
  private readonly webUserPublicUrl =
    process.env.WEB_USER_PUBLIC_URL ?? "http://localhost:4001";
  private readonly apiGatewayPublicUrl =
    process.env.API_GATEWAY_PUBLIC_URL ?? "http://localhost:3000";

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(PaymentProof)
    private readonly proofsRepository: Repository<PaymentProof>,
    private readonly httpService: HttpService,
  ) {}

  // ---------------------------------------------------------------------
  // Upstream helpers
  // ---------------------------------------------------------------------

  private async fetchOrderAsBuyer(
    orderId: string,
    authorizationHeader: string,
  ): Promise<UpstreamOrder> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamOrder>(
          `${this.orderServiceUrl}/orders/${orderId}`,
          {
            headers: { Authorization: authorizationHeader },
            timeout: HTTP_TIMEOUT_MS,
          },
        ),
      );
      return res.data;
    } catch (error) {
      if (isAxiosError(error) && error.response) {
        if (error.response.status === 404) {
          throw new NotFoundException("Order not found");
        }
        if (error.response.status === 403) {
          throw new ForbiddenException("You may not pay for this order");
        }
        throw new BadGatewayException("Order service returned an error");
      }
      throw new BadGatewayException("Order service is unavailable");
    }
  }

  private async fetchOrderInternal(orderId: string): Promise<UpstreamOrder> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamOrder>(
          `${this.orderServiceUrl}/internal/orders/${orderId}`,
          {
            headers: { "x-internal-secret": this.internalSecret },
            timeout: HTTP_TIMEOUT_MS,
          },
        ),
      );
      return res.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException("Order not found");
      }
      throw new BadGatewayException("Order service is unavailable");
    }
  }

  private async confirmOrderInternal(orderId: string): Promise<void> {
    await firstValueFrom(
      this.httpService.patch(
        `${this.orderServiceUrl}/internal/orders/${orderId}/confirm-payment`,
        {},
        {
          headers: { "x-internal-secret": this.internalSecret },
          timeout: HTTP_TIMEOUT_MS,
        },
      ),
    );
  }

  private async fetchEventPublic(eventId: string): Promise<UpstreamEvent | null> {
    try {
      const res = await firstValueFrom(
        this.httpService.get<UpstreamEvent>(
          `${this.eventServiceUrl}/events/${eventId}`,
          { timeout: HTTP_TIMEOUT_MS },
        ),
      );
      return res.data;
    } catch {
      return null;
    }
  }

  private async markSeatSoldInternal(
    seatMapVersionId: string,
    seatId: string,
    orderId: string,
  ): Promise<void> {
    await firstValueFrom(
      this.httpService.post(
        `${this.venueServiceUrl}/seat-map-versions/${seatMapVersionId}/seats/${seatId}/mark-sold`,
        { orderId },
        {
          headers: { "x-internal-secret": this.internalSecret },
          timeout: HTTP_TIMEOUT_MS,
        },
      ),
    );
  }

  /**
   * Runs once a payment is actually confirmed (PayHere IPN success, or an
   * admin approving a payment-proof). Confirms the order is a hard
   * requirement — its failure propagates so PayHere retries the webhook.
   * Marking individual seats sold is best-effort per seat: one seat
   * failing to update shouldn't block the others or the order
   * confirmation itself, since the payment has genuinely succeeded either
   * way.
   */
  private async orchestrateOrderConfirmation(orderId: string): Promise<void> {
    await this.confirmOrderInternal(orderId);

    const order = await this.fetchOrderInternal(orderId);
    const seatedItems = order.items.filter((item) => item.seatId);
    if (seatedItems.length === 0) {
      return;
    }

    const event = await this.fetchEventPublic(order.eventId);
    if (!event?.seatMapVersionId) {
      this.logger.warn(
        `Order ${orderId} has seated items but event ${order.eventId} has no seatMapVersionId`,
      );
      return;
    }

    for (const item of seatedItems) {
      try {
        await this.markSeatSoldInternal(
          event.seatMapVersionId,
          item.seatId!,
          orderId,
        );
      } catch (error) {
        this.logger.error(
          `Failed to mark seat ${item.seatId} sold for order ${orderId}: ${(error as Error).message}`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // Payment record helpers
  // ---------------------------------------------------------------------

  private async getOrCreatePayment(order: UpstreamOrder): Promise<Payment> {
    const existing = await this.paymentsRepository.findOne({
      where: { orderId: order.id },
    });
    if (existing) {
      if (existing.status === PaymentStatus.APPROVED) {
        throw new BadRequestException("This order has already been paid");
      }
      return existing;
    }
    return this.paymentsRepository.save(
      this.paymentsRepository.create({
        orderId: order.id,
        buyerId: order.buyerId,
        amountMinorUnits: order.totalMinorUnits,
        currency: order.currency,
        method: order.paymentMethod,
        status: PaymentStatus.PENDING,
      }),
    );
  }

  // ---------------------------------------------------------------------
  // PayHere
  // ---------------------------------------------------------------------

  async initiate(
    dto: InitiatePaymentDto,
    authorizationHeader: string,
  ): Promise<Record<string, string>> {
    const order = await this.fetchOrderAsBuyer(dto.orderId, authorizationHeader);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot pay for an order in status ${order.status}`,
      );
    }
    if (order.paymentMethod !== PaymentMethod.PAYHERE) {
      throw new BadRequestException(
        "This order was not set up for PayHere checkout",
      );
    }

    const payment = await this.getOrCreatePayment(order);
    const hash = computeCheckoutHash({
      merchantId: this.merchantId,
      merchantSecret: this.merchantSecret,
      orderId: order.id,
      amountMinorUnits: payment.amountMinorUnits,
      currency: payment.currency,
    });

    return {
      action: this.checkoutUrl,
      merchant_id: this.merchantId,
      return_url: `${this.webUserPublicUrl}/orders/${order.id}?payment=return`,
      cancel_url: `${this.webUserPublicUrl}/orders/${order.id}?payment=cancelled`,
      notify_url: `${this.apiGatewayPublicUrl}/api/payments/webhook`,
      order_id: order.id,
      items: `Ceylon Events order ${order.id.slice(0, 8)}`,
      currency: payment.currency,
      amount: formatPayHereAmount(payment.amountMinorUnits),
      first_name: dto.billing.firstName,
      last_name: dto.billing.lastName,
      email: dto.billing.email,
      phone: dto.billing.phone,
      address: dto.billing.address,
      city: dto.billing.city,
      country: dto.billing.country ?? "Sri Lanka",
      hash,
    };
  }

  /**
   * Real end-to-end PayHere IPN delivery requires notify_url to be
   * publicly reachable, which a local/sandboxed dev environment isn't —
   * this endpoint is still fully correct and independently testable by
   * POSTing a form body with a signature computed the same way (see
   * payhere.util.ts), which is how it should be exercised without a
   * public tunnel (ngrok or similar) in front of this service.
   */
  async handleWebhook(dto: PayHereIpnDto): Promise<void> {
    const signatureValid = verifyIpnSignature({
      merchantId: this.merchantId,
      merchantSecret: this.merchantSecret,
      orderId: dto.order_id,
      payhereAmount: dto.payhere_amount,
      payhereCurrency: dto.payhere_currency,
      statusCode: dto.status_code,
      receivedSignature: dto.md5sig,
    });
    if (!signatureValid) {
      this.logger.warn(
        `Rejected PayHere IPN for order ${dto.order_id}: signature mismatch`,
      );
      throw new BadRequestException("Invalid signature");
    }

    const payment = await this.paymentsRepository.findOne({
      where: { orderId: dto.order_id },
    });
    if (!payment) {
      this.logger.warn(
        `PayHere IPN for unknown order ${dto.order_id} — ignoring`,
      );
      return;
    }

    // Idempotent: PayHere may redeliver the same IPN.
    if (payment.status === PaymentStatus.APPROVED) {
      return;
    }

    if (dto.status_code === "2") {
      payment.status = PaymentStatus.APPROVED;
      payment.payherePaymentId = dto.payment_id ?? null;
      await this.paymentsRepository.save(payment);
      await this.orchestrateOrderConfirmation(payment.orderId);
    } else if (["-1", "-2", "-3"].includes(dto.status_code)) {
      payment.status = PaymentStatus.REJECTED;
      await this.paymentsRepository.save(payment);
    }
    // status_code "0" (pending) — nothing to do yet.
  }

  // ---------------------------------------------------------------------
  // Payment proof
  // ---------------------------------------------------------------------

  async submitProof(
    orderId: string,
    dto: SubmitPaymentProofDto,
    authorizationHeader: string,
  ): Promise<{ payment: Payment; proof: PaymentProof }> {
    const order = await this.fetchOrderAsBuyer(orderId, authorizationHeader);
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Cannot submit a payment proof for an order in status ${order.status}`,
      );
    }
    if (order.paymentMethod !== PaymentMethod.PAYMENT_PROOF) {
      throw new BadRequestException(
        "This order was not set up for payment-proof upload",
      );
    }

    const payment = await this.getOrCreatePayment(order);
    // A fresh submission always resets to PENDING — covers both the
    // first-ever proof and resubmission after a rejection.
    payment.status = PaymentStatus.PENDING;
    await this.paymentsRepository.save(payment);

    const proof = await this.proofsRepository.save(
      this.proofsRepository.create({
        paymentId: payment.id,
        orderId: order.id,
        objectKey: dto.objectKey,
        publicUrl: dto.publicUrl,
        referenceNote: dto.referenceNote,
        status: PaymentStatus.PENDING,
      }),
    );

    return { payment, proof };
  }

  async listProofs(
    status: PaymentStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<PaymentProof>> {
    const [items, total] = await this.proofsRepository.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  private async getProofOrThrow(id: string): Promise<PaymentProof> {
    const proof = await this.proofsRepository.findOne({ where: { id } });
    if (!proof) {
      throw new NotFoundException("Payment proof not found");
    }
    return proof;
  }

  async approveProof(
    id: string,
    dto: ReviewPaymentProofDto,
    caller: JwtAccessPayload,
  ): Promise<{ payment: Payment; proof: PaymentProof }> {
    const proof = await this.getProofOrThrow(id);
    if (proof.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("This proof has already been reviewed");
    }
    proof.status = PaymentStatus.APPROVED;
    proof.reviewedByUserId = caller.sub;
    proof.reviewedAt = new Date();
    proof.reviewNotes = dto.notes ?? null;
    await this.proofsRepository.save(proof);

    const payment = await this.paymentsRepository.findOne({
      where: { id: proof.paymentId },
    });
    if (!payment) {
      throw new NotFoundException("Payment not found for this proof");
    }
    payment.status = PaymentStatus.APPROVED;
    await this.paymentsRepository.save(payment);

    await this.orchestrateOrderConfirmation(payment.orderId);

    return { payment, proof };
  }

  async rejectProof(
    id: string,
    dto: ReviewPaymentProofDto,
    caller: JwtAccessPayload,
  ): Promise<{ payment: Payment; proof: PaymentProof }> {
    const proof = await this.getProofOrThrow(id);
    if (proof.status !== PaymentStatus.PENDING) {
      throw new BadRequestException("This proof has already been reviewed");
    }
    proof.status = PaymentStatus.REJECTED;
    proof.reviewedByUserId = caller.sub;
    proof.reviewedAt = new Date();
    proof.reviewNotes = dto.notes ?? null;
    await this.proofsRepository.save(proof);

    const payment = await this.paymentsRepository.findOne({
      where: { id: proof.paymentId },
    });
    if (payment) {
      payment.status = PaymentStatus.REJECTED;
      await this.paymentsRepository.save(payment);
    }

    return { payment: payment!, proof };
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async getForOrder(
    orderId: string,
    caller: JwtAccessPayload,
  ): Promise<{ payment: Payment | null; proofs: PaymentProof[] }> {
    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
    });
    if (payment && payment.buyerId !== caller.sub && !isPlatformAdmin(caller)) {
      throw new ForbiddenException("You may not view this payment");
    }
    if (!payment) {
      return { payment: null, proofs: [] };
    }
    const proofs = await this.proofsRepository.find({
      where: { paymentId: payment.id },
      order: { createdAt: "DESC" },
    });
    return { payment, proofs };
  }
}
