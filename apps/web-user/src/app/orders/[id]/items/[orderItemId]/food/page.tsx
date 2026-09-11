"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  EventListing,
  FoodPreOrderSnapshot,
  MenuCategory,
  Order,
  Restaurant,
} from "@/lib/types";

interface CartLine {
  quantity: number;
  notes: string;
}

const CUTOFF_MESSAGE_MARKER = "editing has closed";

export default function FoodPreOrderPage() {
  const params = useParams<{ id: string; orderItemId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [event, setEvent] = useState<EventListing | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cutoffClosed, setCutoffClosed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user || !params.id || !params.orderItemId) return;

    (async () => {
      try {
        const o = await apiFetch<Order>(`/orders/${params.id}`);
        const item = o.items.find((i) => i.id === params.orderItemId);
        if (!item) {
          throw new Error("This ticket was not found on that order");
        }
        setOrder(o);

        const [e, existing] = await Promise.all([
          apiFetch<EventListing>(`/events/${o.eventId}`),
          apiFetch<FoodPreOrderSnapshot | null>(
            `/food-pre-orders/by-order-item/${params.orderItemId}`,
          ).catch(() => null),
        ]);
        setEvent(e);

        const [r, m] = await Promise.all([
          apiFetch<Restaurant>(`/restaurants/${e.restaurantId}`),
          apiFetch<MenuCategory[]>(`/restaurants/${e.restaurantId}/menu`),
        ]);
        setRestaurant(r);
        setMenu(m);

        if (existing) {
          const prefill: Record<string, CartLine> = {};
          for (const line of existing.items) {
            prefill[line.menuItemId] = {
              quantity: line.quantity,
              notes: line.notes ?? "",
            };
          }
          setCart(prefill);
        }
      } catch (err) {
        setLoadError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load menu",
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, [authLoading, user, params.id, params.orderItemId]);

  const menuItemsById = useMemo(() => {
    const map: Record<
      string,
      { name: string; priceMinorUnits: number; currency: string }
    > = {};
    for (const category of menu) {
      for (const item of category.items) {
        map[item.id] = {
          name: item.name,
          priceMinorUnits: item.priceMinorUnits,
          currency: item.currency,
        };
      }
    }
    return map;
  }, [menu]);

  const cartEntries = Object.entries(cart).filter(([, line]) => line.quantity > 0);
  const currency = menu[0]?.items[0]?.currency ?? "LKR";
  const grandTotalMinorUnits = cartEntries.reduce((sum, [menuItemId, line]) => {
    const info = menuItemsById[menuItemId];
    return sum + (info ? info.priceMinorUnits * line.quantity : 0);
  }, 0);

  function setQuantity(menuItemId: string, quantity: number) {
    setCart((prev) => ({
      ...prev,
      [menuItemId]: {
        quantity: Math.max(0, quantity),
        notes: prev[menuItemId]?.notes ?? "",
      },
    }));
  }

  function setNotes(menuItemId: string, notes: string) {
    setCart((prev) => ({
      ...prev,
      [menuItemId]: {
        quantity: prev[menuItemId]?.quantity ?? 0,
        notes,
      },
    }));
  }

  async function handleSubmit() {
    if (!order || cartEntries.length === 0) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await apiFetch<FoodPreOrderSnapshot>(
        `/food-pre-orders/by-order-item/${params.orderItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            orderId: order.id,
            items: cartEntries.map(([menuItemId, line]) => ({
              menuItemId,
              quantity: line.quantity,
              ...(line.notes ? { notes: line.notes } : {}),
            })),
          }),
        },
      );
      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to submit food pre-order";
      setSubmitError(message);
      if (message.toLowerCase().includes(CUTOFF_MESSAGE_MARKER)) {
        setCutoffClosed(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || authLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-8">Loading…</main>;
  }

  if (loadError || !order || !event || !restaurant) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 text-brand-400">
        {loadError ?? "Unable to load this ticket"}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href={`/orders/${order.id}`}
        className="text-sm text-brand-600 hover:underline"
      >
        ← Back to order
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-white">
        Pre-order food — {event.title}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {restaurant.name}. This is settled and paid for at the venue — no
        payment is collected here.
      </p>

      {cutoffClosed && (
        <div className="mt-4 rounded-lg border border-brand-800 bg-brand-600/10 p-4 text-sm text-brand-400">
          {submitError}
        </div>
      )}

      {submitted && (
        <div className="mt-4 rounded-lg border border-trust-700 bg-trust-500/10 p-4 text-sm text-trust-300">
          Your food pre-order has been saved.{" "}
          <Link href={`/orders/${order.id}`} className="underline">
            Back to order
          </Link>
        </div>
      )}

      {submitError && !cutoffClosed && (
        <p className="mt-4 text-sm text-brand-400">{submitError}</p>
      )}

      <div className="mt-6 space-y-8">
        {menu.length === 0 && (
          <p className="text-sm text-zinc-500">
            This restaurant hasn&apos;t published a menu yet.
          </p>
        )}
        {menu.map((category) => (
          <section key={category.id}>
            <h2 className="text-lg font-medium text-white">
              {category.name}
            </h2>
            <div className="mt-3 space-y-3">
              {category.items.map((item) => {
                const line = cart[item.id] ?? { quantity: 0, notes: "" };
                return (
                  <Card key={item.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">
                            {item.name}
                          </h3>
                          {!item.isAvailable && (
                            <Badge tone="danger">Unavailable</Badge>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-1 text-sm text-zinc-500">
                            {item.description}
                          </p>
                        )}
                        {item.dietaryTags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.dietaryTags.map((tag) => (
                              <Badge key={tag} tone="neutral">
                                {tag.replace("_", " ").toLowerCase()}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <span className="mt-2 block text-sm font-semibold text-brand-600">
                          {item.currency} {(item.priceMinorUnits / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={cutoffClosed || !item.isAvailable}
                            onClick={() => setQuantity(item.id, line.quantity - 1)}
                            className="h-8 w-8 rounded-md border border-zinc-700 text-zinc-300 disabled:opacity-50"
                          >
                            −
                          </button>
                          <span className="w-6 text-center">{line.quantity}</span>
                          <button
                            type="button"
                            disabled={cutoffClosed || !item.isAvailable}
                            onClick={() => setQuantity(item.id, line.quantity + 1)}
                            className="h-8 w-8 rounded-md border border-zinc-700 text-zinc-300 disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    {line.quantity > 0 && (
                      <input
                        disabled={cutoffClosed}
                        placeholder="Notes (e.g. no onions)"
                        value={line.notes}
                        onChange={(e) => setNotes(item.id, e.target.value)}
                        className="mt-3 w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 disabled:opacity-50"
                      />
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {menu.length > 0 && (
        <Card className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Your food pre-order
          </h2>
          {cartEntries.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              Add items above to build your pre-order.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {cartEntries.map(([menuItemId, line]) => {
                const info = menuItemsById[menuItemId];
                if (!info) return null;
                return (
                  <div
                    key={menuItemId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-zinc-300">
                      {info.name} × {line.quantity}
                    </span>
                    <span className="text-white">
                      {info.currency}{" "}
                      {((info.priceMinorUnits * line.quantity) / 100).toFixed(2)}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3 font-medium">
                <span>Total (pay at the venue)</span>
                <span>
                  {currency} {(grandTotalMinorUnits / 100).toFixed(2)}
                </span>
              </div>
            </div>
          )}
          <Button
            className="mt-4"
            disabled={cutoffClosed || cartEntries.length === 0 || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Saving…" : "Submit food pre-order"}
          </Button>
        </Card>
      )}
    </main>
  );
}
