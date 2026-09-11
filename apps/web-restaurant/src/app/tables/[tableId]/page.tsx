"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { SeatMapSnapshot, TableBookingStatus } from "@ceylon/shared-types";
import { aggregateTableStatuses } from "@ceylon/shared-types";
import { Badge, Button, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, getStoredTokens } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

type FoodOrderStatus = "RECEIVED" | "PREPARING" | "READY" | "SERVED";
type FoodOrderSource = "PRE_ORDER" | "WAITER";

interface EventListing {
  id: string;
  restaurantId: string;
  seatMapVersionId: string | null;
  title: string;
  startsAt: string;
}

interface FoodPreOrderItemSnapshot {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  notes: string | null;
  priceMinorUnits: number;
}

interface FoodPreOrderSnapshot {
  id: string;
  tableId: string | null;
  tableNumber: string | null;
  seatLabel: string | null;
  status: FoodOrderStatus;
  source: FoodOrderSource;
  notes: string | null;
  items: FoodPreOrderItemSnapshot[];
  createdAt: string;
}

const STATUS_ORDER: FoodOrderStatus[] = ["RECEIVED", "PREPARING", "READY", "SERVED"];
const STATUS_TONE: Record<FoodOrderStatus, "neutral" | "warning" | "success"> = {
  RECEIVED: "neutral",
  PREPARING: "warning",
  READY: "success",
  SERVED: "neutral",
};
const BOOKING_TONE: Record<TableBookingStatus, "success" | "warning" | "neutral"> = {
  BOOKED: "success",
  HELD: "warning",
  AVAILABLE: "neutral",
};

export default function TableDetailPage() {
  const params = useParams<{ tableId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const eventId = searchParams.get("eventId");
  const tableId = params.tableId;

  const authorized =
    !!user &&
    (user.roles.includes("RESTAURANT_OWNER") ||
      user.roles.includes("RESTAURANT_STAFF"));

  const [event, setEvent] = useState<EventListing | null>(null);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<TableBookingStatus | null>(null);
  const [orders, setOrders] = useState<FoodPreOrderSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const loadOrders = useCallback(async () => {
    if (!eventId) return;
    try {
      const result = await apiFetch<FoodPreOrderSnapshot[]>(
        `/food-pre-orders/by-event/${eventId}?tableId=${tableId}`,
      );
      setOrders(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load table orders");
    }
  }, [eventId, tableId]);

  useEffect(() => {
    if (!authorized || !eventId) return;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const e = await apiFetch<EventListing>(`/events/${eventId}`);
        setEvent(e);
        if (!e.seatMapVersionId) {
          setError("This event has no table map.");
          return;
        }
        const [snapshot, availability] = await Promise.all([
          apiFetch<SeatMapSnapshot>(`/seat-map-versions/${e.seatMapVersionId}`),
          apiFetch<Record<string, string>>(
            `/seat-map-versions/${e.seatMapVersionId}/availability`,
          ),
        ]);
        const table = snapshot.tables.find((t) => t.id === tableId);
        if (!table) {
          setError("Table could not be found for this event.");
          return;
        }
        setTableNumber(table.tableNumber);
        const statuses = aggregateTableStatuses(
          snapshot,
          availability as never,
        );
        setBookingStatus(statuses[tableId] ?? "AVAILABLE");
        await loadOrders();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load table");
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, eventId, tableId]);

  // Reuses the exact same event-scoped SSE stream the Phase 5 dashboard
  // subscribes to — this page just filters incoming snapshots down to its
  // own table rather than opening a second transport.
  useEffect(() => {
    if (!eventId) return;
    eventSourceRef.current?.close();
    const tokens = getStoredTokens();
    if (!tokens?.accessToken) return;

    const apiBase = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api`;
    const url = `${apiBase}/food-pre-orders/by-event/${eventId}/stream?token=${encodeURIComponent(tokens.accessToken)}`;
    const es = new EventSource(url);
    es.onmessage = () => loadOrders();
    eventSourceRef.current = es;
    return () => es.close();
  }, [eventId, loadOrders]);

  async function updateStatus(id: string, status: FoodOrderStatus) {
    try {
      const updated = await apiFetch<FoodPreOrderSnapshot>(
        `/food-pre-orders/${id}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setOrders((prev) => prev?.map((o) => (o.id === id ? updated : o)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  if (authLoading || !user || isLoading) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!authorized) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-sm text-zinc-500">
            The table floor is only available to restaurant owners and staff.
          </p>
        </main>
      </>
    );
  }

  if (!eventId) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-sm text-zinc-500">
            No event selected —{" "}
            <Link href="/tables" className="text-brand-500 underline">
              pick one from the event floor
            </Link>
            .
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/tables"
          className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white"
        >
          ← Event floor
        </Link>

        <div className="mt-3 flex items-center justify-between">
          <h1 className="text-2xl font-black uppercase tracking-tightest text-white">
            Table {tableNumber ?? "—"}
          </h1>
          {bookingStatus && (
            <Badge tone={BOOKING_TONE[bookingStatus]}>{bookingStatus}</Badge>
          )}
        </div>
        {event && <p className="mt-1 text-sm text-zinc-500">{event.title}</p>}

        {error && (
          <Card className="mt-4 border-brand-800 bg-brand-600/10">
            <p className="text-sm text-brand-300">{error}</p>
          </Card>
        )}

        {bookingStatus && bookingStatus !== "BOOKED" && (
          <Card className="mt-4 border-zinc-800">
            <p className="text-sm text-zinc-400">
              {bookingStatus === "HELD"
                ? "A guest is mid-checkout for this table — orders can be placed once their booking is confirmed."
                : "This table does not currently have a confirmed booking for this event."}
            </p>
          </Card>
        )}

        <h2 className="mb-3 mt-6 font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
          Active food orders
        </h2>

        {orders === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-zinc-500">No food orders for this table yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <Card key={order.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge tone={order.source === "WAITER" ? "brand" : "neutral"}>
                    {order.source === "WAITER" ? "Waiter" : "Pre-order"}
                  </Badge>
                  <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
                </div>
                <ul className="mb-3 flex flex-col gap-1 text-sm text-zinc-300">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.menuItemName}
                      {item.notes && (
                        <span className="text-zinc-500"> — {item.notes}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {order.notes && (
                  <p className="mb-3 text-sm text-zinc-500">Note: {order.notes}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {STATUS_ORDER.map((s) => (
                    <Button
                      key={s}
                      variant={s === order.status ? "primary" : "secondary"}
                      className="px-2 py-1 text-xs"
                      onClick={() => updateStatus(order.id, s)}
                      disabled={s === order.status}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {bookingStatus === "BOOKED" && (
          <Button
            className="mt-6 w-full"
            onClick={() =>
              router.push(`/tables/${tableId}/new-order?eventId=${eventId}`)
            }
          >
            + New table order
          </Button>
        )}
      </main>
    </>
  );
}
