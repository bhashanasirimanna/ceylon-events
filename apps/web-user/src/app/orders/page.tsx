"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderStatus } from "@ceylon/shared-types";
import { Badge, Card } from "@ceylon/design-system";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { EventListing, Order } from "@/lib/types";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function MyOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [events, setEvents] = useState<Record<string, EventListing>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    apiFetch<Order[]>("/orders/me")
      .then(async (result) => {
        setOrders(result);
        const uniqueEventIds = Array.from(
          new Set(result.map((o) => o.eventId)),
        );
        const fetched = await Promise.all(
          uniqueEventIds.map((id) =>
            apiFetch<EventListing>(`/events/${id}`).catch(() => null),
          ),
        );
        const map: Record<string, EventListing> = {};
        fetched.forEach((e) => {
          if (e) map[e.id] = e;
        });
        setEvents(map);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load orders"),
      );
  }, [authLoading, user]);

  if (authLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-8">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">My orders</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {orders === null ? (
        <p className="mt-4 text-sm text-neutral-500">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">
          You haven&apos;t placed any orders yet.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="flex items-center justify-between transition-shadow hover:shadow-md">
                <div>
                  <p className="font-medium text-neutral-900">
                    {events[order.eventId]?.title ?? order.eventId}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {formatDate(order.createdAt)} ·{" "}
                    {formatMoney(order.totalMinorUnits, order.currency)}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
