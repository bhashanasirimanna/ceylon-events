"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OrderStatus } from "@ceylon/shared-types";
import { Badge, Button, Card } from "@ceylon/design-system";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { EventListing, Order, TicketTier } from "@/lib/types";

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

function formatMoney(minorUnits: number, currency: string): string {
  return `${currency} ${(minorUnits / 100).toFixed(2)}`;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<EventListing | null>(null);
  const [tiers, setTiers] = useState<Record<string, TicketTier>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

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
        const [e, tierEntries] = await Promise.all([
          apiFetch<EventListing>(`/events/${o.eventId}`).catch(() => null),
          Promise.all(
            Array.from(new Set(o.items.map((i) => i.ticketTierId))).map(
              (id) =>
                apiFetch<TicketTier>(`/ticket-tiers/${id}`)
                  .then((t) => [id, t] as const)
                  .catch(() => null),
            ),
          ),
        ]);
        setEvent(e);
        const map: Record<string, TicketTier> = {};
        tierEntries.forEach((entry) => {
          if (entry) map[entry[0]] = entry[1];
        });
        setTiers(map);
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
    return <main className="mx-auto max-w-2xl px-4 py-8">Loading…</main>;
  }

  if (error && !order) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 text-red-600">{error}</main>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 rounded-lg border border-brand-300 bg-brand-50 p-4 text-sm text-brand-700">
        Payment collection isn&apos;t live yet — this order is reserved as
        Pending until the Payments phase ships.
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">
          {event ? event.title : "Order"}
        </h1>
        <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
      </div>

      {event && (
        <Link
          href={`/events/${event.id}`}
          className="mt-1 inline-block text-sm text-brand-600 hover:underline"
        >
          View event
        </Link>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <Card className="mt-4">
        <div className="space-y-3">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between border-b border-neutral-100 pb-3 last:border-none last:pb-0"
            >
              <div>
                <p className="font-medium text-neutral-900">
                  {tiers[item.ticketTierId]?.name ?? item.ticketTierId}
                </p>
                {item.seatLabel && (
                  <p className="text-sm text-neutral-500">
                    Seat {item.seatLabel}
                  </p>
                )}
              </div>
              <span className="text-sm text-neutral-700">
                {formatMoney(item.priceMinorUnits, order.currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-3">
          <span className="font-medium text-neutral-900">Total</span>
          <span className="font-semibold text-brand-600">
            {formatMoney(order.totalMinorUnits, order.currency)}
          </span>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Payment method: {order.paymentMethod}
        </p>
      </Card>

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
