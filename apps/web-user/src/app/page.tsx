"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PaginatedResult, Restaurant } from "@/lib/types";
import { MediaCard, Section, SectionHeader } from "@ceylon/design-system";

export default function HomePage() {
  const router = useRouter();
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
    <main>
      <section className="border-b border-zinc-900 bg-surface-alt px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 font-mono text-xs font-bold uppercase tracking-widest text-brand-500">
            Ceylon Events
          </p>
          <h1 className="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tightest text-white sm:text-6xl">
            Dinner, drinks, and a{" "}
            <span className="text-brand-500">show</span>
          </h1>
          <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-zinc-400">
            Browse restaurant venues, preview their menus, and pre-order your
            food before you even get there.
          </p>

          <input
            type="text"
            placeholder="Search restaurants by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-8 w-full max-w-sm rounded-none border border-zinc-700 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </section>

      <Section tone="base">
        <SectionHeader eyebrow="Where to go" title="PARTNER" accent="RESTAURANTS" />

        {isLoading && <p className="text-sm text-zinc-500">Loading restaurants…</p>}
        {error && <p className="text-sm text-brand-400">{error}</p>}
        {!isLoading && !error && filtered.length === 0 && (
          <p className="text-sm text-zinc-500">No restaurants found.</p>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((restaurant) => (
            <MediaCard
              key={restaurant.id}
              imageUrl={restaurant.coverPhotoUrl}
              imageAlt={restaurant.name}
              title={restaurant.name}
              subtitle={restaurant.address}
              footer={
                restaurant.description ? (
                  <p className="line-clamp-2 text-sm text-zinc-400">
                    {restaurant.description}
                  </p>
                ) : undefined
              }
              onClick={() => router.push(`/restaurants/${restaurant.id}`)}
            />
          ))}
        </div>
      </Section>
    </main>
  );
}
