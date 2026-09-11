"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@ceylon/design-system";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { EventListing, PaginatedResult, Restaurant } from "@/lib/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [restaurants, setRestaurants] = useState<Record<string, Restaurant>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PaginatedResult<EventListing>>("/events?page=1&pageSize=50")
      .then(async (result) => {
        setEvents(result.items);
        const uniqueRestaurantIds = Array.from(
          new Set(result.items.map((e) => e.restaurantId)),
        );
        const fetched = await Promise.all(
          uniqueRestaurantIds.map((id) =>
            apiFetch<Restaurant>(`/restaurants/${id}`).catch(() => null),
          ),
        );
        const map: Record<string, Restaurant> = {};
        fetched.forEach((r) => {
          if (r) map[r.id] = r;
        });
        setRestaurants(map);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load events"),
      );
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-white">Events</h1>

      {error && <p className="mt-4 text-sm text-brand-400">{error}</p>}

      {events === null ? (
        <p className="mt-4 text-sm text-zinc-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No events are open for booking yet.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <h2 className="font-medium text-white">
                  {event.title}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatDateTime(event.startsAt)}
                </p>
                {restaurants[event.restaurantId] && (
                  <p className="mt-1 text-sm text-zinc-500">
                    {restaurants[event.restaurantId].name}
                  </p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
