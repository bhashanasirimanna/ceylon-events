"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { EventStatus } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Event, PaginatedResult } from "@/lib/types";
import { Nav } from "@/components/Nav";

const STATUS_TONE: Record<EventStatus, "neutral" | "success" | "danger"> = {
  [EventStatus.DRAFT]: "neutral",
  [EventStatus.PUBLISHED]: "success",
  [EventStatus.CANCELLED]: "danger",
  [EventStatus.COMPLETED]: "neutral",
};

export default function RestaurantEventsPage() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<PaginatedResult<Event>>(
        `/events?restaurantId=${restaurantId}&pageSize=50`,
      );
      setEvents(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load events");
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      load();
    }
  }, [isLoading, user, router, load]);

  async function setStatus(id: string, status: EventStatus) {
    setActioningId(id);
    setError(null);
    try {
      await apiFetch(`/events/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActioningId(null);
    }
  }

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Events</h1>
            <Link
              href="/restaurants"
              className="text-sm text-brand-600 hover:underline"
            >
              Back to restaurants
            </Link>
          </div>
          <Link href={`/restaurants/${restaurantId}/events/new`}>
            <Button>+ New event</Button>
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {events === null ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-neutral-500">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-neutral-900">
                      {event.title}
                    </h2>
                    <Badge tone={STATUS_TONE[event.status]}>
                      {event.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-500">
                    {new Date(event.startsAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/events/${event.id}`}>
                    <Button variant="secondary">Manage</Button>
                  </Link>
                  {event.status === EventStatus.DRAFT && (
                    <Button
                      variant="primary"
                      disabled={actioningId === event.id}
                      onClick={() => setStatus(event.id, EventStatus.PUBLISHED)}
                    >
                      Publish
                    </Button>
                  )}
                  {(event.status === EventStatus.DRAFT ||
                    event.status === EventStatus.PUBLISHED) && (
                    <Button
                      variant="danger"
                      disabled={actioningId === event.id}
                      onClick={() => setStatus(event.id, EventStatus.CANCELLED)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
