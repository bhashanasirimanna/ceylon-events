"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, getStoredTokens } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

type FoodOrderStatus = "RECEIVED" | "PREPARING" | "READY" | "SERVED";

interface EventListing {
  id: string;
  restaurantId: string;
  title: string;
  startsAt: string;
  status: string;
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
  orderId: string;
  orderItemId: string;
  eventId: string;
  restaurantId: string;
  buyerId: string;
  seatId: string | null;
  seatLabel: string | null;
  tableNumber: string | null;
  status: FoodOrderStatus;
  items: FoodPreOrderItemSnapshot[];
  createdAt: string;
  updatedAt: string;
}

interface MenuItemAggregate {
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
}

const STATUS_ORDER: FoodOrderStatus[] = [
  "RECEIVED",
  "PREPARING",
  "READY",
  "SERVED",
];

const STATUS_TONE: Record<FoodOrderStatus, "neutral" | "warning" | "success"> = {
  RECEIVED: "neutral",
  PREPARING: "warning",
  READY: "success",
  SERVED: "neutral",
};

const GENERAL_ADMISSION_BUCKET = "General Admission";

function formatEventOption(event: EventListing): string {
  return `${event.title} — ${new Date(event.startsAt).toLocaleString()}`;
}

export default function FoodOrdersPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const authorized =
    !!user &&
    (user.roles.includes("RESTAURANT_OWNER") ||
      user.roles.includes("RESTAURANT_STAFF") ||
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("ADMIN"));

  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "summary">("table");
  const [statusFilter, setStatusFilter] = useState<FoodOrderStatus | "">("");

  const [foodOrders, setFoodOrders] = useState<FoodPreOrderSnapshot[] | null>(
    null,
  );
  const [summary, setSummary] = useState<MenuItemAggregate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderItemIds, setSelectedOrderItemIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkTargetStatus, setBulkTargetStatus] =
    useState<FoodOrderStatus>("PREPARING");

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  // Load this restaurant's events for the picker.
  useEffect(() => {
    if (!authorized || !user?.restaurantId) return;
    apiFetch<{ items: EventListing[] }>(
      `/events?restaurantId=${user.restaurantId}&page=1&pageSize=50`,
    )
      .then((res) => {
        setEvents(res.items);
        if (res.items.length > 0) {
          setSelectedEventId((prev) => prev ?? res.items[0].id);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load events");
      });
  }, [authorized, user?.restaurantId]);

  const loadFoodOrders = useCallback(
    async (eventId: string, status: FoodOrderStatus | "") => {
      try {
        const query = status ? `?status=${status}` : "";
        const result = await apiFetch<FoodPreOrderSnapshot[]>(
          `/food-pre-orders/by-event/${eventId}${query}`,
        );
        setFoodOrders(result);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : "Failed to load food pre-orders",
        );
      }
    },
    [],
  );

  const loadSummary = useCallback(async (eventId: string) => {
    try {
      const result = await apiFetch<MenuItemAggregate[]>(
        `/food-pre-orders/by-event/${eventId}/summary`,
      );
      setSummary(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load prep summary",
      );
    }
  }, []);

  // Reload data + reconnect SSE whenever the selected event (or status
  // filter) changes.
  useEffect(() => {
    if (!selectedEventId) return;
    setError(null);
    setSelectedOrderItemIds(new Set());
    loadFoodOrders(selectedEventId, statusFilter);
    loadSummary(selectedEventId);

    eventSourceRef.current?.close();
    const tokens = getStoredTokens();
    if (!tokens?.accessToken) return;

    const apiBase = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api`;
    const url = `${apiBase}/food-pre-orders/by-event/${selectedEventId}/stream?token=${encodeURIComponent(tokens.accessToken)}`;
    const es = new EventSource(url);
    es.onmessage = () => {
      // Simplest correct approach: refetch both views on any change rather
      // than patching local state — data volumes here are small.
      loadFoodOrders(selectedEventId, statusFilter);
      loadSummary(selectedEventId);
    };
    es.onerror = () => {
      // EventSource retries connections on its own; nothing to do here.
    };
    eventSourceRef.current = es;

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, statusFilter]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const groupedByTable = useMemo(() => {
    if (!foodOrders) return [];
    const groups = new Map<string, FoodPreOrderSnapshot[]>();
    for (const fpo of foodOrders) {
      const key = fpo.tableNumber ?? GENERAL_ADMISSION_BUCKET;
      const existing = groups.get(key);
      if (existing) {
        existing.push(fpo);
      } else {
        groups.set(key, [fpo]);
      }
    }
    const entries = Array.from(groups.entries());
    entries.sort(([a], [b]) => {
      if (a === GENERAL_ADMISSION_BUCKET) return 1;
      if (b === GENERAL_ADMISSION_BUCKET) return -1;
      return a.localeCompare(b, undefined, { numeric: true });
    });
    return entries;
  }, [foodOrders]);

  async function updateStatus(orderItemId: string, status: FoodOrderStatus) {
    try {
      const updated = await apiFetch<FoodPreOrderSnapshot>(
        `/food-pre-orders/by-order-item/${orderItemId}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setFoodOrders(
        (prev) =>
          prev?.map((fpo) => (fpo.orderItemId === orderItemId ? updated : fpo)) ??
          prev,
      );
      if (selectedEventId) {
        loadSummary(selectedEventId);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to update status",
      );
    }
  }

  async function applyBulkStatus() {
    if (selectedOrderItemIds.size === 0) return;
    try {
      await apiFetch<FoodPreOrderSnapshot[]>("/food-pre-orders/bulk-status", {
        method: "PATCH",
        body: JSON.stringify({
          orderItemIds: Array.from(selectedOrderItemIds),
          status: bulkTargetStatus,
        }),
      });
      if (selectedEventId) {
        await loadFoodOrders(selectedEventId, statusFilter);
        await loadSummary(selectedEventId);
      }
      setSelectedOrderItemIds(new Set());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to apply bulk update",
      );
    }
  }

  function toggleSelected(orderItemId: string) {
    setSelectedOrderItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderItemId)) {
        next.delete(orderItemId);
      } else {
        next.add(orderItemId);
      }
      return next;
    });
  }

  if (isLoading || !user) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!authorized) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-sm text-zinc-500">
            Food orders are only available to restaurant owners and staff.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Food Pre-Orders
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Live view of attendee food pre-orders, grouped by table, plus a
          pre-event prep summary.
        </p>

        {error && (
          <Card className="mb-4 border-brand-800 bg-brand-600/10">
            <p className="text-sm text-brand-300">{error}</p>
          </Card>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-400">
            Event:{" "}
            <select
              className="ml-1 rounded-none border border-zinc-700 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={selectedEventId ?? ""}
              onChange={(e) => setSelectedEventId(e.target.value || null)}
            >
              {(events ?? []).map((event) => (
                <option key={event.id} value={event.id}>
                  {formatEventOption(event)}
                </option>
              ))}
            </select>
          </label>

          {events !== null && events.length === 0 && (
            <span className="text-sm text-zinc-500">
              No events found for your restaurant yet.
            </span>
          )}
        </div>

        <div className="mb-6 flex gap-2">
          <Button
            variant={view === "table" ? "primary" : "secondary"}
            onClick={() => setView("table")}
          >
            By table
          </Button>
          <Button
            variant={view === "summary" ? "primary" : "secondary"}
            onClick={() => setView("summary")}
          >
            Prep summary
          </Button>
        </div>

        {view === "table" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="text-sm text-zinc-400">
                Status:{" "}
                <select
                  className="ml-1 rounded-none border border-zinc-700 bg-black/40 px-2 py-1.5 text-sm text-white"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as FoodOrderStatus | "")
                  }
                >
                  <option value="">All</option>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {selectedOrderItemIds.size > 0 && (
                <div className="flex items-center gap-2 rounded-none border border-zinc-800 bg-zinc-900 px-3 py-1.5">
                  <span className="text-sm text-zinc-400">
                    {selectedOrderItemIds.size} selected
                  </span>
                  <select
                    className="rounded-none border border-zinc-700 bg-black/40 px-2 py-1 text-sm text-white placeholder:text-zinc-500"
                    value={bulkTargetStatus}
                    onChange={(e) =>
                      setBulkTargetStatus(e.target.value as FoodOrderStatus)
                    }
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Button onClick={applyBulkStatus}>Apply to selected</Button>
                </div>
              )}
            </div>

            {foodOrders === null ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : groupedByTable.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No food pre-orders yet for this event.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {groupedByTable.map(([tableNumber, orders]) => (
                  <Card key={tableNumber}>
                    <h2 className="mb-3 font-medium text-white">
                      {tableNumber === GENERAL_ADMISSION_BUCKET
                        ? tableNumber
                        : `Table ${tableNumber}`}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {orders.map((fpo) => (
                        <div
                          key={fpo.orderItemId}
                          className="rounded-none border border-zinc-800 p-3"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedOrderItemIds.has(
                                  fpo.orderItemId,
                                )}
                                onChange={() => toggleSelected(fpo.orderItemId)}
                              />
                              <span className="text-sm text-zinc-400">
                                {fpo.seatLabel
                                  ? `Seat ${fpo.seatLabel}`
                                  : "General Admission"}
                              </span>
                            </div>
                            <Badge tone={STATUS_TONE[fpo.status]}>
                              {fpo.status}
                            </Badge>
                          </div>
                          <ul className="mb-3 flex flex-col gap-1 text-sm text-zinc-300">
                            {fpo.items.map((item) => (
                              <li key={item.id}>
                                {item.quantity}× {item.menuItemName}
                                {item.notes && (
                                  <span className="text-zinc-500">
                                    {" "}
                                    — {item.notes}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                          <div className="flex flex-wrap gap-1">
                            {STATUS_ORDER.map((s) => (
                              <Button
                                key={s}
                                variant={s === fpo.status ? "primary" : "secondary"}
                                className="px-2 py-1 text-xs"
                                onClick={() => updateStatus(fpo.orderItemId, s)}
                                disabled={s === fpo.status}
                              >
                                {s}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {view === "summary" && (
          <Card>
            <h2 className="mb-3 font-medium text-white">
              Total quantity needed per menu item
            </h2>
            {summary === null ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : summary.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No food pre-orders yet for this event.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-500">
                    <th className="py-2">Menu item</th>
                    <th className="py-2 text-right">Total quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr
                      key={row.menuItemId}
                      className="border-b border-zinc-800"
                    >
                      <td className="py-2 text-white">
                        {row.menuItemName}
                      </td>
                      <td className="py-2 text-right font-medium text-white">
                        {row.totalQuantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </main>
    </>
  );
}
