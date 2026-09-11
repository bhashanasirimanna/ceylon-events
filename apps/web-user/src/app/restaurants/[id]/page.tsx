"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { MenuCategory, RatingSummary, Restaurant } from "@/lib/types";
import { Badge, Button, Card } from "@ceylon/design-system";

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
    return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  }

  if (error || !restaurant) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-red-600">
        {error ?? "Restaurant not found"}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {restaurant.name}
        </h1>
        {formatRatingSummary(ratingSummary) && (
          <span className="text-sm text-neutral-500">
            {formatRatingSummary(ratingSummary)}
          </span>
        )}
      </div>
      <p className="mt-1 text-neutral-500">{restaurant.address}</p>
      {restaurant.description && (
        <p className="mt-4 text-neutral-700">{restaurant.description}</p>
      )}

      <h2 className="mt-10 text-xl font-semibold text-neutral-900">Menu</h2>
      {menu.length === 0 && (
        <p className="mt-2 text-neutral-500">
          This restaurant hasn&apos;t published a menu yet.
        </p>
      )}
      <div className="mt-4 space-y-8">
        {menu.map((category) => (
          <section key={category.id}>
            <h3 className="text-lg font-medium text-neutral-900">
              {category.name}
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {category.items.map((item) => (
                <Card key={item.id}>
                  {item.photoUrls.length > 0 && (
                    <div className="mb-3 flex gap-1.5 overflow-x-auto">
                      {item.photoUrls.map((url, index) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt={`${item.name} photo ${index + 1}`}
                          className="h-24 w-32 flex-none rounded-md object-cover"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-neutral-900">
                      {item.name}
                    </h4>
                    <span className="whitespace-nowrap text-sm font-semibold text-brand-600">
                      {item.currency} {(item.priceMinorUnits / 100).toFixed(2)}
                    </span>
                  </div>
                  {item.avgRating !== null && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      ★ {item.avgRating.toFixed(1)}
                    </p>
                  )}
                  {item.description && (
                    <p className="mt-1 text-sm text-neutral-500">
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
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 rounded-lg border border-dashed border-neutral-300 p-6 text-center text-neutral-500">
        <p className="font-medium">Events at this venue — coming soon</p>
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
      </section>
    </main>
  );
}
