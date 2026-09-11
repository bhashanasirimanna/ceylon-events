"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { MenuCategory, RatingSummary, Restaurant } from "@/lib/types";
import { Badge, Button, MediaCard, Section, SectionHeader } from "@ceylon/design-system";

interface LatestSeatMapVersion {
  id: string;
}

function formatRatingSummary(summary: RatingSummary | null): string | null {
  if (!summary) return null;
  if (summary.count === 0 || summary.average === null) {
    return "No ratings yet";
  }
  return `★ ${summary.average.toFixed(1)} (${summary.count} rating${summary.count === 1 ? "" : "s"})`;
}

export default function RestaurantDetailPage() {
  const params = useParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [seatMapVersionId, setSeatMapVersionId] = useState<string | null>(
    null,
  );
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(
    null,
  );

  useEffect(() => {
    if (!params.id) return;
    Promise.all([
      apiFetch<Restaurant>(`/restaurants/${params.id}`),
      apiFetch<MenuCategory[]>(`/restaurants/${params.id}/menu`),
    ])
      .then(([r, m]) => {
        setRestaurant(r);
        setMenu(m);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load restaurant"),
      )
      .finally(() => setIsLoading(false));

    apiFetch<LatestSeatMapVersion>(
      `/seat-map-versions/by-restaurant/${params.id}/latest`,
    )
      .then((version) => setSeatMapVersionId(version.id))
      .catch(() => setSeatMapVersionId(null));

    apiFetch<RatingSummary>(`/ratings/summary?restaurantId=${params.id}`)
      .then(setRatingSummary)
      .catch(() => setRatingSummary(null));
  }, [params.id]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-zinc-500">Loading…</main>
    );
  }

  if (error || !restaurant) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-brand-400">
        {error ?? "Restaurant not found"}
      </main>
    );
  }

  return (
    <main>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black uppercase tracking-tightest text-white">
            {restaurant.name}
          </h1>
          {formatRatingSummary(ratingSummary) && (
            <span className="text-sm text-zinc-500">
              {formatRatingSummary(ratingSummary)}
            </span>
          )}
        </div>
        <p className="mt-1 text-zinc-400">{restaurant.address}</p>
        {restaurant.description && (
          <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-zinc-300">
            {restaurant.description}
          </p>
        )}
      </div>

      <Section tone="alt">
        <SectionHeader eyebrow="What's on offer" title="THE" accent="MENU" />
        {menu.length === 0 && (
          <p className="text-sm text-zinc-500">
            This restaurant hasn&apos;t published a menu yet.
          </p>
        )}
        <div className="space-y-10">
          {menu.map((category) => (
            <section key={category.id}>
              <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-brand-500">
                {category.name}
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {category.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    imageUrl={item.photoUrls[0]}
                    imageAlt={item.name}
                    eyebrow={
                      item.avgRating !== null
                        ? `★ ${item.avgRating.toFixed(1)}`
                        : undefined
                    }
                    title={item.name}
                    subtitle={item.description}
                    meta={
                      <span className="rounded-none bg-black/70 px-2 py-1 font-mono text-xs font-bold text-white">
                        {item.currency} {(item.priceMinorUnits / 100).toFixed(2)}
                      </span>
                    }
                    footer={
                      item.dietaryTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.dietaryTags.map((tag) => (
                            <Badge key={tag} tone="neutral">
                              {tag.replace("_", " ").toLowerCase()}
                            </Badge>
                          ))}
                        </div>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Section>

      <Section tone="base">
        <div className="border border-dashed border-zinc-800 p-8 text-center text-zinc-500">
          <p className="font-bold text-zinc-300">
            Events at this venue — coming soon
          </p>
          <p className="mt-1 text-sm">
            Ticketed events hosted here will appear once event booking goes
            live.
          </p>
          {seatMapVersionId && (
            <div className="mt-4">
              <Link href={`/restaurants/${params.id}/seat-picker/${seatMapVersionId}`}>
                <Button variant="secondary">Preview the seat picker</Button>
              </Link>
            </div>
          )}
        </div>
      </Section>
    </main>
  );
}
