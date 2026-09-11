"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { SeatStatusMap } from "@ceylon/seatmap-ui";
import type {
  PromoCodeValidationResult,
  SeatMapSnapshot,
} from "@ceylon/shared-types";
import { PaymentMethod, SeatStatus } from "@ceylon/shared-types";
import { Button, Card } from "@ceylon/design-system";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { EventListing, Order, TicketTier } from "@/lib/types";

// konva/react-konva require browser APIs (and konva's Node entry pulls in
// the native `canvas` package, which isn't installed) — loading this only
// on the client sidesteps SSR entirely rather than fighting webpack
// externals, which don't reliably apply in `next dev`.
const SeatMapCanvas = dynamic(
  () => import("@ceylon/seatmap-ui").then((mod) => mod.SeatMapCanvas),
  { ssr: false },
);

// This page's seat-hold state management (fetch snapshot, poll
// availability, hold/renew/release, localStorage persistence, countdown)
// duplicates most of
// src/app/restaurants/[id]/seat-picker/[versionId]/page.tsx. That page is a
// standalone preview with no notion of ticket tiers or order creation, so
// rather than contort it into a shared checkout dependency, the logic is
// re-implemented here. A shared hook would be a reasonable follow-up.

interface HoldResponse {
  seatId: string;
  holderToken: string;
  expiresAt: string;
}

interface StoredHold {
  seatId: string;
  holderToken: string;
  expiresAt: string;
}

const AVAILABILITY_POLL_MS = 5000;

function holdStorageKey(versionId: string): string {
  return `ceylon_seat_hold_${versionId}`;
}

function loadStoredHold(versionId: string): StoredHold | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(holdStorageKey(versionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredHold;
  } catch {
    return null;
  }
}

function saveStoredHold(versionId: string, hold: StoredHold | null): void {
  if (typeof window === "undefined") return;
  if (hold) {
    window.localStorage.setItem(holdStorageKey(versionId), JSON.stringify(hold));
  } else {
    window.localStorage.removeItem(holdStorageKey(versionId));
  }
}

function formatCountdown(expiresAt: string): string {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return "0:00";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatPrice(tier: TicketTier): string {
  return `${tier.currency} ${(tier.priceMinorUnits / 100).toFixed(2)}`;
}

export default function CheckoutPage() {
  const params = useParams<{ id: string; tierId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [event, setEvent] = useState<EventListing | null>(null);
  const [tier, setTier] = useState<TicketTier | null>(null);
  const [snapshot, setSnapshot] = useState<SeatMapSnapshot | null>(null);
  const [seatStatuses, setSeatStatuses] = useState<SeatStatusMap>({});
  const [hold, setHold] = useState<StoredHold | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.PAYHERE,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacing, setIsPlacing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [, forceTick] = useState(0);

  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoResult, setPromoResult] = useState<PromoCodeValidationResult | null>(
    null,
  );
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const holdRef = useRef<StoredHold | null>(null);
  holdRef.current = hold;

  const eventId = params.id;
  const tierId = params.tierId;
  const versionId = event?.seatMapVersionId ?? null;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!eventId || !tierId) return;
    apiFetch<EventListing>(`/events/${eventId}`)
      .then(async (e) => {
        setEvent(e);
        const t = await apiFetch<TicketTier>(`/ticket-tiers/${tierId}`);
        setTier(t);

        if (e.seatMapVersionId) {
          setHold(loadStoredHold(e.seatMapVersionId));
          const snap = await apiFetch<SeatMapSnapshot>(
            `/seat-map-versions/${e.seatMapVersionId}`,
          );
          setSnapshot(snap);
        } else {
          setReviewing(true);
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load checkout"),
      )
      .finally(() => setIsLoading(false));
  }, [eventId, tierId]);

  const refreshAvailability = useCallback(async () => {
    if (!versionId) return;
    const query = holdRef.current?.holderToken
      ? `?holderToken=${encodeURIComponent(holdRef.current.holderToken)}`
      : "";
    try {
      const statuses = await apiFetch<SeatStatusMap>(
        `/seat-map-versions/${versionId}/availability${query}`,
      );
      setSeatStatuses(statuses);
    } catch {
      // Transient poll failure — keep showing the last known statuses.
    }
  }, [versionId]);

  useEffect(() => {
    if (!versionId || reviewing) return;
    refreshAvailability();
    const interval = setInterval(refreshAvailability, AVAILABILITY_POLL_MS);
    return () => clearInterval(interval);
  }, [versionId, reviewing, refreshAvailability]);

  useEffect(() => {
    if (!hold || reviewing) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [hold, reviewing]);

  async function handleSeatClick(seatId: string) {
    if (!versionId) return;
    if (hold?.seatId === seatId) return;

    setError(null);
    try {
      if (hold) {
        await apiFetch(`/seat-map-versions/${versionId}/holds/${hold.seatId}`, {
          method: "DELETE",
          body: JSON.stringify({ holderToken: hold.holderToken }),
        });
      }
      const result = await apiFetch<HoldResponse>(
        `/seat-map-versions/${versionId}/holds`,
        { method: "POST", body: JSON.stringify({ seatId }) },
      );
      const newHold: StoredHold = {
        seatId: result.seatId,
        holderToken: result.holderToken,
        expiresAt: result.expiresAt,
      };
      setHold(newHold);
      saveStoredHold(versionId, newHold);
      await refreshAvailability();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Someone just took this seat.");
        await refreshAvailability();
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to hold seat");
      }
    }
  }

  async function handleRelease() {
    if (!hold || !versionId) return;
    setError(null);
    try {
      await apiFetch(`/seat-map-versions/${versionId}/holds/${hold.seatId}`, {
        method: "DELETE",
        body: JSON.stringify({ holderToken: hold.holderToken }),
      });
      setHold(null);
      saveStoredHold(versionId, null);
      await refreshAvailability();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to release seat");
    }
  }

  async function handleRenew() {
    if (!hold || !versionId) return;
    setError(null);
    try {
      const result = await apiFetch<HoldResponse>(
        `/seat-map-versions/${versionId}/holds/${hold.seatId}/renew`,
        { method: "POST", body: JSON.stringify({ holderToken: hold.holderToken }) },
      );
      const renewed: StoredHold = {
        seatId: result.seatId,
        holderToken: result.holderToken,
        expiresAt: result.expiresAt,
      };
      setHold(renewed);
      saveStoredHold(versionId, renewed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to renew hold");
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        setHold(null);
        saveStoredHold(versionId, null);
      }
    }
  }

  async function handleValidatePromo() {
    if (!event || !promoCodeInput.trim()) return;
    setPromoError(null);
    setIsValidatingPromo(true);
    try {
      const result = await apiFetch<PromoCodeValidationResult>(
        `/promo-codes/validate?eventId=${encodeURIComponent(event.id)}&code=${encodeURIComponent(promoCodeInput.trim())}`,
      );
      setPromoResult(result);
      if (!result.valid) {
        setPromoError(result.reason ?? "This promo code isn't valid");
      }
    } catch (err) {
      setPromoResult(null);
      setPromoError(
        err instanceof ApiError ? err.message : "Failed to validate promo code",
      );
    } finally {
      setIsValidatingPromo(false);
    }
  }

  function estimatedDiscount(): number {
    if (!tier || !promoResult?.valid || !promoResult.promoCode) return 0;
    const promo = promoResult.promoCode;
    if (
      promo.applicableTicketTierId &&
      promo.applicableTicketTierId !== tier.id
    ) {
      return 0;
    }
    if (promo.discountType === "PERCENTAGE") {
      return Math.floor((tier.priceMinorUnits * promo.discountValue) / 100);
    }
    if (promo.discountType === "FIXED") {
      return Math.min(promo.discountValue, tier.priceMinorUnits);
    }
    return 0;
  }

  async function handlePlaceOrder() {
    if (!event || !tier) return;
    setError(null);
    setIsPlacing(true);
    try {
      const items = hold
        ? [
            {
              ticketTierId: tier.id,
              seatId: hold.seatId,
              holderToken: hold.holderToken,
            },
          ]
        : [{ ticketTierId: tier.id }];
      const order = await apiFetch<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({
          eventId: event.id,
          paymentMethod,
          items,
          ...(promoResult?.valid ? { promoCode: promoCodeInput.trim() } : {}),
        }),
      });
      if (versionId) {
        saveStoredHold(versionId, null);
      }
      router.push(`/orders/${order.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && versionId) {
        setError(`${err.message} Pick a different seat.`);
        setHold(null);
        saveStoredHold(versionId, null);
        setReviewing(false);
        await refreshAvailability();
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to place order");
      }
    } finally {
      setIsPlacing(false);
    }
  }

  if (isLoading || authLoading) {
    return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  }

  if (error && (!event || !tier)) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-red-600">{error}</main>
    );
  }

  if (!event || !tier) {
    return null;
  }

  const heldSeatLabel =
    hold && snapshot
      ? snapshot.tables
          .flatMap((t) => t.seats)
          .find((s) => s.id === hold.seatId)?.seatLabel
      : null;

  if (!reviewing) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-black uppercase tracking-tightest text-white">
          {event.title} — pick a seat
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {tier.name} · {formatPrice(tier)}
        </p>

        {error && <p className="mt-3 text-sm text-brand-400">{error}</p>}

        {snapshot && (
          <div className="mt-4 overflow-x-auto border border-zinc-800 bg-surface-raised p-2">
            <SeatMapCanvas
              data={snapshot}
              seatStatuses={seatStatuses}
              mode="picker"
              onSeatClick={handleSeatClick}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-zinc-800" />
            Available
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-perk-500" />
            Held by someone else
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-brand-500" />
            Held by you
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-zinc-600" />
            Sold
          </span>
        </div>

        {hold && (
          <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium text-white">
                Holding seat {heldSeatLabel ?? hold.seatId}
              </p>
              <p className="text-sm text-zinc-400">
                Hold expires in {formatCountdown(hold.expiresAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleRenew}>
                Renew hold
              </Button>
              <Button variant="danger" onClick={handleRelease}>
                Release seat
              </Button>
              <Button variant="primary" onClick={() => setReviewing(true)}>
                Continue to review
              </Button>
            </div>
          </Card>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-black uppercase tracking-tightest text-white">
        Review your order
      </h1>

      {error && <p className="mt-3 text-sm text-brand-400">{error}</p>}

      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-white">{event.title}</h2>
            <p className="text-sm text-zinc-400">{tier.name}</p>
            {heldSeatLabel && (
              <p className="text-sm text-zinc-400">
                Seat {heldSeatLabel}
              </p>
            )}
          </div>
          <span className="font-semibold text-brand-600">
            {formatPrice(tier)}
          </span>
        </div>
        {promoResult?.valid && estimatedDiscount() > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
            <span className="text-zinc-400">After promo code (estimated)</span>
            <span className="font-medium text-white">
              {formatPrice({
                ...tier,
                priceMinorUnits: tier.priceMinorUnits - estimatedDiscount(),
              })}
            </span>
          </div>
        )}
      </Card>

      {versionId && hold && (
        <p className="mt-3 text-sm text-zinc-400">
          Seat hold expires in {formatCountdown(hold.expiresAt)}.{" "}
          <button
            type="button"
            className="text-brand-600 underline"
            onClick={() => setReviewing(false)}
          >
            Back to seat picker
          </button>
        </p>
      )}

      <h3 className="mt-6 font-medium text-white">Promo code</h3>
      <div className="mt-2 flex gap-2">
        <input
          value={promoCodeInput}
          onChange={(e) => {
            setPromoCodeInput(e.target.value);
            setPromoResult(null);
            setPromoError(null);
          }}
          placeholder="Enter promo code"
          className="flex-1 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
        <Button
          variant="secondary"
          disabled={isValidatingPromo || !promoCodeInput.trim()}
          onClick={handleValidatePromo}
        >
          {isValidatingPromo ? "Checking…" : "Apply"}
        </Button>
      </div>
      {promoError && <p className="mt-2 text-sm text-brand-400">{promoError}</p>}
      {promoResult?.valid && (
        <div className="mt-2 flex items-center justify-between border border-trust-700 bg-trust-500/10 px-3 py-2 text-sm text-trust-300">
          <span>Promo code applied</span>
          <span className="font-medium">
            -{formatPrice({ ...tier, priceMinorUnits: estimatedDiscount() })}
          </span>
        </div>
      )}

      <h3 className="mt-6 font-medium text-white">Payment method</h3>
      <div className="mt-2 space-y-2">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === PaymentMethod.PAYHERE}
            onChange={() => setPaymentMethod(PaymentMethod.PAYHERE)}
          />
          Pay Online (PayHere)
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === PaymentMethod.PAYMENT_PROOF}
            onChange={() => setPaymentMethod(PaymentMethod.PAYMENT_PROOF)}
          />
          Upload Payment Proof
        </label>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Payment collection isn&apos;t live yet — either option currently just
        reserves your order as Pending.
      </p>

      <Button
        className="mt-6 w-full"
        variant="party"
        disabled={isPlacing}
        onClick={handlePlaceOrder}
      >
        {isPlacing
          ? "Placing order…"
          : `Place order — ${formatPrice({
              ...tier,
              priceMinorUnits: tier.priceMinorUnits - estimatedDiscount(),
            })}`}
      </Button>
    </main>
  );
}
