"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PaginatedResult, Restaurant } from "@/lib/types";
import { Card } from "@ceylon/design-system";

export default function HomePage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiFetch<PaginatedResult<Restaurant>>("/restaurants?page=1&pageSize=20")
      .then((result) => setRestaurants(result.items))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load restaurants"),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return restaurants;
    return restaurants.filter((r) => r.name.toLowerCase().includes(term));
  }, [restaurants, search]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Discover events at partner restaurants
      </h1>
      <p className="mt-1 text-neutral-500">
        Browse restaurant venues and preview their menus before you book.
      </p>

      <input
        type="text"
        placeholder="Search restaurants by name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mt-6 w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      {isLoading && <p className="mt-8 text-neutral-500">Loading restaurants…</p>}
      {error && <p className="mt-8 text-red-600">{error}</p>}

      {!isLoading && !error && filtered.length === 0 && (
        <p className="mt-8 text-neutral-500">No restaurants found.</p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((restaurant) => (
          <Link key={restaurant.id} href={`/restaurants/${restaurant.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <h2 className="font-semibold text-neutral-900">
                {restaurant.name}
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                {restaurant.address}
              </p>
              {restaurant.description && (
                <p className="mt-2 line-clamp-2 text-sm text-neutral-700">
                  {restaurant.description}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
