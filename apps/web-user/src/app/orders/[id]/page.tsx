"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RatingSubjectType,
  TicketStatus,
} from "@ceylon/shared-types";
import {
  Badge,
  Button,
  Card,
  QRCodeDisplay,
  fireConfetti,
  usePrefersReducedMotion,
} from "@ceylon/design-system";
import type { OfferSnapshot } from "@ceylon/shared-types";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { RatingForm } from "@/components/RatingForm";
import type {
  EventListing,
  FoodPreOrderSnapshot,
  Order,
  PayHereCheckoutParams,
  PaymentForOrder,
  PresignUploadResponse,
  Ticket,
  TicketTier,
} from "@/lib/types";

const STATUS_TONE: Record<
  OrderStatus,
  "warning" | "success" | "danger" | "neutral"
> = {
  [OrderStatus.PENDING]: "warning",
  [OrderStatus.PAID]: "success",
  [OrderStatus.CONFIRMED]: "success",
  [OrderStatus.CANCELLED]: "danger",
  [OrderStatus.REFUNDED]: "danger",
};

const PAYMENT_PROOF_TONE: Record<
  PaymentStatus,
  "warning" | "success" | "danger" | "neutral"
> = {
  [PaymentStatus.PENDING]: "warning",
  [PaymentStatus.APPROVED]: "success",
  [PaymentStatus.REJECTED]: "danger",
  [PaymentStatus.REFUNDED]: "danger",
};

function formatMoney(minorUnits: number, currency: string): string {
  return `${currency} ${(minorUnits / 100).toFixed(2)}`;
}

/** PayHere requires a real browser form POST, not a fetch/redirect. */
function submitToPayHere(params: PayHereCheckoutParams) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = params.action;
  for (const [key, value] of Object.entries(params)) {
    if (key === "action") continue;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<EventListing | null>(null);
  const [tiers, setTiers] = useState<Record<string, TicketTier>>({});
  const [offersByTier, setOffersByTier] = useState<
    Record<string, OfferSnapshot[]>
  >({});
  const [paymentInfo, setPaymentInfo] = useState<PaymentForOrder | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [foodPreOrdersByItem, setFoodPreOrdersByItem] = useState<
    Record<string, FoodPreOrderSnapshot | null>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasCelebratedRef = useRef(false);

  const paymentReturnFlag = searchParams.get("payment");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  function load() {
    if (!params.id) return;
    apiFetch<Order>(`/orders/${params.id}`)
      .then(async (o) => {
        setOrder(o);
        const [e, tierEntries, payment, ticketList] = await Promise.all([
          apiFetch<EventListing>(`/events/${o.eventId}`).catch(() => null),
          Promise.all(
            Array.from(new Set(o.items.map((i) => i.ticketTierId))).map(
              (id) =>
                apiFetch<TicketTier>(`/ticket-tiers/${id}`)
                  .then((t) => [id, t] as const)
                  .catch(() => null),
            ),
          ),
          apiFetch<PaymentForOrder>(`/payments/order/${o.id}`).catch(
            () => null,
          ),
          o.status === OrderStatus.CONFIRMED
            ? apiFetch<Ticket[]>(`/tickets/for-order/${o.id}`).catch(() => [])
            : Promise.resolve([]),
        ]);
        setEvent(e);
        const map: Record<string, TicketTier> = {};
        tierEntries.forEach((entry) => {
          if (entry) map[entry[0]] = entry[1];
        });
        setTiers(map);
        setPaymentInfo(payment);
        setTickets(ticketList);

        const offerEntries = await Promise.all(
          Array.from(new Set(o.items.map((i) => i.ticketTierId))).map(
            (tierId) =>
              apiFetch<OfferSnapshot[]>(`/offers/by-ticket-tier/${tierId}`)
                .then((offers) => [tierId, offers] as const)
                .catch(() => [tierId, []] as const),
          ),
        );
        setOffersByTier(Object.fromEntries(offerEntries));

        const foodPreOrderEntries = await Promise.all(
          o.items.map((item) =>
            apiFetch<FoodPreOrderSnapshot | null>(
              `/food-pre-orders/by-order-item/${item.id}`,
            )
              .then((fpo) => [item.id, fpo] as const)
              .catch(() => [item.id, null] as const),
          ),
        );
        setFoodPreOrdersByItem(Object.fromEntries(foodPreOrderEntries));
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load order"),
      )
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (!authLoading && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, authLoading, user]);

  // Real reward moment: only the redirect-back-from-payment landing on an
  // already-CONFIRMED order, and only once per visit — never on every
  // subsequent view of an old order.
  useEffect(() => {
    if (
      order?.status === OrderStatus.CONFIRMED &&
      paymentReturnFlag === "return" &&
      !hasCelebratedRef.current
    ) {
      hasCelebratedRef.current = true;
      fireConfetti({ reducedMotion: prefersReducedMotion });
    }
  }, [order?.status, paymentReturnFlag, prefersReducedMotion]);

  async function handleCancel() {
    if (!order) return;
    setIsCancelling(true);
    setError(null);
    try {
      await apiFetch(`/orders/${order.id}/cancel`, { method: "PATCH" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel order");
    } finally {
      setIsCancelling(false);
    }
  }

  if (isLoading || authLoading) {
    return <main className="mx-auto max-w-2xl px-4 py-8 text-zinc-500">Loading…</main>;
  }

  if (error && !order) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 text-brand-400">{error}</main>
    );
  }

  if (!order) {
    return null;
  }

  const eventStarted = !!event && new Date(event.startsAt).getTime() <= Date.now();
  const canRate = order.status === OrderStatus.CONFIRMED && eventStarted;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {paymentReturnFlag === "return" && (
        <div className="mb-4 border border-brand-800 bg-brand-600/10 p-4 text-sm text-brand-300">
          Redirected back from PayHere — this page reflects the order&apos;s
          real status once PayHere confirms the payment on our server, not
          just from this redirect.
        </div>
      )}
      {paymentReturnFlag === "cancelled" && (
        <div className="mb-4 border border-perk-700 bg-perk-500/10 p-4 text-sm text-perk-300">
          Checkout was cancelled at PayHere. You can try again below.
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black uppercase tracking-tightest text-white">
          {event ? event.title : "Order"}
        </h1>
        <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
      </div>

      {event && (
        <Link
          href={`/events/${event.id}`}
          className="mt-1 inline-block text-sm text-brand-500 hover:underline"
        >
          View event
        </Link>
      )}

      {error && <p className="mt-3 text-sm text-brand-400">{error}</p>}

      <Card className="mt-4">
        <div className="space-y-3">
          {order.items.map((item) => {
            const offers = offersByTier[item.ticketTierId] ?? [];
            const foodPreOrder = foodPreOrdersByItem[item.id];
            return (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-zinc-800 pb-3 last:border-none last:pb-0"
              >
                <div>
                  <p className="font-medium text-white">
                    {tiers[item.ticketTierId]?.name ?? item.ticketTierId}
                  </p>
                  {item.seatLabel && (
                    <p className="text-sm text-zinc-500">
                      Seat {item.seatLabel}
                    </p>
                  )}
                  {offers.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {offers.map((offer) => (
                        <li
                          key={offer.id}
                          className="font-mono text-xs font-bold uppercase tracking-widest text-perk-500"
                        >
                          Includes: {offer.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {order.status !== OrderStatus.CANCELLED &&
                    order.status !== OrderStatus.REFUNDED && (
                      <Link
                        href={`/orders/${order.id}/items/${item.id}/food`}
                        className="mt-1 inline-block text-sm text-brand-500 hover:underline"
                      >
                        Pre-order food for this ticket →
                      </Link>
                    )}
                  {foodPreOrder && foodPreOrder.items.length > 0 && (
                    <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
                      {foodPreOrder.items.map((line) => (
                        <div key={line.id}>
                          <p className="text-xs text-zinc-500">
                            {line.quantity}× {line.menuItemName}
                          </p>
                          {canRate && (
                            <RatingForm
                              orderId={order.id}
                              eventId={order.eventId}
                              subjectType={RatingSubjectType.MENU_ITEM}
                              subjectId={line.menuItemId}
                              label={`Rate ${line.menuItemName}`}
                              ratedLabel={`You rated ${line.menuItemName}`}
                              compact
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="font-mono text-sm text-zinc-300">
                  {formatMoney(item.priceMinorUnits, order.currency)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-1 border-t border-zinc-800 pt-3">
          <div className="flex items-center justify-between font-mono text-sm text-zinc-400">
            <span>Subtotal</span>
            <span>{formatMoney(order.subtotalMinorUnits, order.currency)}</span>
          </div>
          {order.discountMinorUnits > 0 && (
            <div className="flex items-center justify-between font-mono text-sm text-perk-500">
              <span>Promo code discount</span>
              <span>
                -{formatMoney(order.discountMinorUnits, order.currency)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-bold text-white">Total</span>
            <span className="font-mono text-lg font-bold text-brand-500">
              {formatMoney(order.totalMinorUnits, order.currency)}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Payment method: {order.paymentMethod}
        </p>
      </Card>

      {order.status === OrderStatus.PENDING && (
        <PaymentSection
          order={order}
          paymentInfo={paymentInfo}
          userEmail={user?.email}
          userFullName={user?.fullName}
          onChanged={load}
        />
      )}

      {order.status === OrderStatus.CONFIRMED && (
        <TicketsSection
          tickets={tickets}
          holderName={user?.fullName}
          bookingRef={order.id}
        />
      )}

      {canRate && event && (
        <Card className="mt-6">
          <RatingForm
            orderId={order.id}
            eventId={event.id}
            subjectType={RatingSubjectType.EVENT}
            subjectId={event.id}
            label="Rate this event"
            ratedLabel="You rated this event"
          />
        </Card>
      )}

      {order.status === OrderStatus.PENDING && (
        <Button
          className="mt-6"
          variant="danger"
          disabled={isCancelling}
          onClick={handleCancel}
        >
          {isCancelling ? "Cancelling…" : "Cancel order"}
        </Button>
      )}
    </main>
  );
}

function TicketsSection({
  tickets,
  holderName,
  bookingRef,
}: {
  tickets: Ticket[];
  holderName: string | undefined;
  bookingRef: string;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-lg font-black uppercase tracking-tightest text-white">
        Your tickets
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Show these QR codes at the door — they&apos;re your proof of
        purchase.
      </p>
      {tickets.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          Tickets are being generated — refresh in a moment.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {tickets.map((ticket) => {
            const checkedIn = ticket.status === TicketStatus.CHECKED_IN;
            return (
              <Card
                key={ticket.id}
                className="flex flex-col items-center gap-3 text-center"
              >
                <QRCodeDisplay
                  dataUrl={ticket.qrCodeDataUrl}
                  size={176}
                  status={checkedIn ? "checked-in" : "valid"}
                />
                <div>
                  {holderName && (
                    <p className="text-sm font-medium text-white">
                      {holderName}
                    </p>
                  )}
                  <p className="text-sm text-zinc-400">
                    {ticket.seatLabel
                      ? `Seat ${ticket.seatLabel}`
                      : "General Admission"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-600">
                    REF {bookingRef.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                {checkedIn && ticket.checkedInAt && (
                  <p className="font-mono text-xs text-zinc-500">
                    Checked in {new Date(ticket.checkedInAt).toLocaleString()}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaymentSection({
  order,
  paymentInfo,
  userEmail,
  userFullName,
  onChanged,
}: {
  order: Order;
  paymentInfo: PaymentForOrder | null;
  userEmail: string | undefined;
  userFullName: string | undefined;
  onChanged: () => void;
}) {
  if (order.paymentMethod === PaymentMethod.PAYHERE) {
    if (paymentInfo?.payment?.status === PaymentStatus.APPROVED) {
      return (
        <div className="mt-6 border border-trust-700 bg-trust-500/10 p-4 text-sm text-trust-300">
          Payment approved — your order will confirm shortly.
        </div>
      );
    }
    return (
      <PayHereForm
        order={order}
        userEmail={userEmail}
        userFullName={userFullName}
      />
    );
  }

  return (
    <PaymentProofSection
      order={order}
      paymentInfo={paymentInfo}
      onChanged={onChanged}
    />
  );
}

function PayHereForm({
  order,
  userEmail,
  userFullName,
}: {
  order: Order;
  userEmail: string | undefined;
  userFullName: string | undefined;
}) {
  const [firstName, setFirstName] = useState(
    userFullName?.split(" ")[0] ?? "",
  );
  const [lastName, setLastName] = useState(
    userFullName?.split(" ").slice(1).join(" ") ?? "",
  );
  const [email, setEmail] = useState(userEmail ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Sri Lanka");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const params = await apiFetch<PayHereCheckoutParams>(
        "/payments/initiate",
        {
          method: "POST",
          body: JSON.stringify({
            orderId: order.id,
            billing: {
              firstName,
              lastName,
              email,
              phone,
              address,
              city,
              country,
            },
          }),
        },
      );
      submitToPayHere(params);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start checkout");
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-black uppercase tracking-tightest text-white">
        Pay with PayHere
      </h2>
      <form onSubmit={handlePay} className="mt-3 space-y-3">
        {error && <p className="text-sm text-brand-400">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
          <input
            required
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
        </div>
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
        <input
          required
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
        <input
          required
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            required
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
          <input
            required
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
          />
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Redirecting…"
            : `Pay ${formatMoney(order.totalMinorUnits, order.currency)} with PayHere`}
        </Button>
      </form>
    </Card>
  );
}

function PaymentProofSection({
  order,
  paymentInfo,
  onChanged,
}: {
  order: Order;
  paymentInfo: PaymentForOrder | null;
  onChanged: () => void;
}) {
  const proofs = paymentInfo?.proofs ?? [];
  const latest = proofs[0];
  const canSubmit = !latest || latest.status === PaymentStatus.REJECTED;

  const [file, setFile] = useState<File | null>(null);
  const [referenceNote, setReferenceNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const presign = await apiFetch<PresignUploadResponse>(
        "/media/presign-upload",
        {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            category: "payment-proof",
          }),
        },
      );

      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Failed to upload the image — please try again");
      }

      await apiFetch(`/payments/${order.id}/proof`, {
        method: "POST",
        body: JSON.stringify({
          objectKey: presign.objectKey,
          publicUrl: presign.publicUrl,
          referenceNote,
        }),
      });

      setFile(null);
      setReferenceNote("");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to submit payment proof",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6">
      <h2 className="text-lg font-black uppercase tracking-tightest text-white">
        Payment proof
      </h2>

      {proofs.length > 0 && (
        <div className="mt-3 space-y-2">
          {proofs.map((proof) => (
            <Card key={proof.id} className="text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">{proof.referenceNote}</span>
                <Badge tone={PAYMENT_PROOF_TONE[proof.status]}>
                  {proof.status}
                </Badge>
              </div>
              {proof.status === PaymentStatus.REJECTED && proof.reviewNotes && (
                <p className="mt-1 text-brand-400">
                  Rejected: {proof.reviewNotes}
                </p>
              )}
              {proof.status === PaymentStatus.PENDING && (
                <p className="mt-1 text-zinc-500">Pending admin review</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {canSubmit && (
        <Card className="mt-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-brand-400">{error}</p>}
            <p className="text-sm text-zinc-400">
              Upload a screenshot or photo of your bank transfer / deposit
              receipt for{" "}
              {formatMoney(order.totalMinorUnits, order.currency)}.
            </p>
            <input
              required
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            <input
              required
              placeholder="Reference note (e.g. bank transfer reference)"
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              className="w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
            />
            <Button type="submit" disabled={isSubmitting || !file}>
              {isSubmitting ? "Submitting…" : "Submit proof"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
