"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  priceMinorUnits: number;
  currency: string;
  isAvailable: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
}

interface CartLine {
  quantity: number;
}

export default function NewTableOrderPage() {
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

  const [menu, setMenu] = useState<MenuCategory[] | null>(null);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generated once and reused across retries: a double-tapped "Place
  // order" resubmits the same key, so the server returns the original
  // order instead of creating a duplicate.
  const clientRequestIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authorized || !user?.restaurantId) return;
    apiFetch<MenuCategory[]>(`/restaurants/${user.restaurantId}/menu`)
      .then(setMenu)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load menu"),
      );
  }, [authorized, user?.restaurantId]);

  useEffect(() => {
    if (!authorized || !eventId) return;
    (async () => {
      try {
        const event = await apiFetch<{ seatMapVersionId: string | null }>(
          `/events/${eventId}`,
        );
        if (!event.seatMapVersionId) return;
        const snapshot = await apiFetch<{
          tables: Array<{ id: string; tableNumber: string }>;
        }>(`/seat-map-versions/${event.seatMapVersionId}`);
        const table = snapshot.tables.find((t) => t.id === tableId);
        setTableNumber(table?.tableNumber ?? null);
      } catch {
        // Non-critical — the page still works without the display label.
      }
    })();
  }, [authorized, eventId, tableId]);

  const menuItemsById = useMemo(() => {
    const map: Record<string, MenuItem> = {};
    for (const category of menu ?? []) {
      for (const item of category.items) {
        map[item.id] = item;
      }
    }
    return map;
  }, [menu]);

  function setQuantity(menuItemId: string, quantity: number) {
    setCart((prev) => ({
      ...prev,
      [menuItemId]: { quantity: Math.max(0, quantity) },
    }));
  }

  const cartEntries = Object.entries(cart).filter(([, line]) => line.quantity > 0);
  const currency = menu?.[0]?.items[0]?.currency ?? "LKR";
  const totalMinorUnits = cartEntries.reduce((sum, [menuItemId, line]) => {
    const item = menuItemsById[menuItemId];
    return sum + (item ? item.priceMinorUnits * line.quantity : 0);
  }, 0);

  const filteredCategories = useMemo(() => {
    if (!menu) return [];
    const query = search.trim().toLowerCase();
    if (!query) return menu;
    return menu
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          item.name.toLowerCase().includes(query),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu, search]);

  async function handleSubmit() {
    if (!eventId || cartEntries.length === 0) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch(`/food-pre-orders/staff`, {
        method: "POST",
        body: JSON.stringify({
          eventId,
          tableId,
          items: cartEntries.map(([menuItemId, line]) => ({
            menuItemId,
            quantity: line.quantity,
          })),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          clientRequestId: clientRequestIdRef.current,
        }),
      });
      router.push(`/tables/${tableId}?eventId=${eventId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || !user) {
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
          href={`/tables/${tableId}?eventId=${eventId}`}
          className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white"
        >
          ← Table
        </Link>

        <h1 className="mt-3 text-2xl font-black uppercase tracking-tightest text-white">
          Add order{tableNumber ? ` — Table ${tableNumber}` : ""}
        </h1>

        {error && <p className="mt-3 text-sm text-brand-400">{error}</p>}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu…"
          className="mt-4 w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />

        <div className="mt-6 flex flex-col gap-8">
          {menu === null && <p className="text-sm text-zinc-500">Loading menu…</p>}
          {menu !== null && filteredCategories.length === 0 && (
            <p className="text-sm text-zinc-500">No menu items match.</p>
          )}
          {filteredCategories.map((category) => (
            <section key={category.id}>
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
                {category.name}
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {category.items.map((item) => {
                  const quantity = cart[item.id]?.quantity ?? 0;
                  return (
                    <Card
                      key={item.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-sm text-brand-500">
                          {item.currency} {(item.priceMinorUnits / 100).toFixed(2)}
                        </p>
                        {!item.isAvailable && (
                          <p className="text-xs text-zinc-500">Unavailable</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!item.isAvailable}
                          onClick={() => setQuantity(item.id, quantity - 1)}
                          className="h-9 w-9 rounded-none border border-zinc-700 text-lg text-zinc-300 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-white">{quantity}</span>
                        <button
                          type="button"
                          disabled={!item.isAvailable}
                          onClick={() => setQuantity(item.id, quantity + 1)}
                          className="h-9 w-9 rounded-none border border-zinc-700 text-lg text-zinc-300 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <h3 className="mt-8 font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
          Special instructions
        </h3>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. no onions"
          className="mt-2 w-full rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />

        <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="text-sm text-zinc-400">
            {cartEntries.reduce((sum, [, line]) => sum + line.quantity, 0)} items
          </span>
          <span className="font-semibold text-white">
            {currency} {(totalMinorUnits / 100).toFixed(2)}
          </span>
        </div>

        <Button
          className="mt-4 w-full"
          disabled={cartEntries.length === 0 || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting
            ? "Placing order…"
            : `Place order${tableNumber ? ` — Table ${tableNumber}` : ""}`}
        </Button>
      </main>
    </>
  );
}
