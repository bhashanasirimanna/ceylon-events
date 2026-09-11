"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { EventStatus } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  Event,
  PaginatedResult,
  RatingSnapshot,
  RestaurantReport,
} from "@/lib/types";
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

  const [report, setReport] = useState<RestaurantReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [ratings, setRatings] = useState<RatingSnapshot[] | null>(null);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);

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

  const loadReport = useCallback(async () => {
    try {
      const result = await apiFetch<RestaurantReport>(
        `/reports/restaurants/${restaurantId}`,
      );
      setReport(result);
    } catch (err) {
      setReportError(
        err instanceof ApiError ? err.message : "Failed to load report",
      );
    }
  }, [restaurantId]);

  const loadRatings = useCallback(async () => {
    try {
      const result = await apiFetch<PaginatedResult<RatingSnapshot>>(
        `/ratings?restaurantId=${restaurantId}`,
        {},
        { auth: false },
      );
      setRatings(result.items);
    } catch (err) {
      setRatingsError(
        err instanceof ApiError ? err.message : "Failed to load ratings",
      );
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      load();
      loadReport();
      loadRatings();
    }
  }, [isLoading, user, router, load, loadReport, loadRatings]);

  async function deleteRating(id: string) {
    if (!confirm("Delete this rating?")) return;
    setDeletingRatingId(id);
    setRatingsError(null);
    try {
      await apiFetch(`/ratings/${id}`, { method: "DELETE" });
      setRatings((current) =>
        current ? current.filter((rating) => rating.id !== id) : current,
      );
    } catch (err) {
      setRatingsError(
        err instanceof ApiError ? err.message : "Failed to delete rating",
      );
    } finally {
      setDeletingRatingId(null);
    }
  }

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
            <h1 className="text-lg font-semibold text-white">Events</h1>
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

        {error && <p className="mb-4 text-sm text-brand-400">{error}</p>}

        {events === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-white">
                      {event.title}
                    </h2>
                    <Badge tone={STATUS_TONE[event.status]}>
                      {event.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500">
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

        <h2 className="mb-3 mt-10 font-medium text-white">Report</h2>
        {reportError && (
          <p className="mb-4 text-sm text-brand-400">{reportError}</p>
        )}
        {report === null ? (
          !reportError && <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <Card className="mb-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-zinc-500">Events</p>
                <p className="text-lg font-semibold text-white">
                  {report.eventCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Tickets sold</p>
                <p className="text-lg font-semibold text-white">
                  {report.ticketsSold}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Revenue</p>
                <p className="text-lg font-semibold text-white">
                  {report.currency} {(report.revenueMinorUnits / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Rating</p>
                <p className="text-lg font-semibold text-white">
                  {report.ratingSummary.average !== null
                    ? `${report.ratingSummary.average.toFixed(1)} ★`
                    : "—"}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    ({report.ratingSummary.count})
                  </span>
                </p>
              </div>
            </div>

            {report.events.length > 0 && (
              <div className="mt-4 overflow-x-auto border-t border-zinc-800 pt-4">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500">
                      <th className="pb-2 font-medium">Event</th>
                      <th className="pb-2 font-medium">Starts</th>
                      <th className="pb-2 font-medium">Tickets sold</th>
                      <th className="pb-2 font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.events.map((ev) => (
                      <tr key={ev.eventId} className="border-t border-zinc-800">
                        <td className="py-2">
                          <Link
                            href={`/events/${ev.eventId}`}
                            className="text-brand-600 hover:underline"
                          >
                            {ev.eventTitle}
                          </Link>
                        </td>
                        <td className="py-2 text-zinc-500">
                          {new Date(ev.startsAt).toLocaleString()}
                        </td>
                        <td className="py-2">{ev.ticketsSold}</td>
                        <td className="py-2">
                          {report.currency} {(ev.revenueMinorUnits / 100).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        <h2 className="mb-3 font-medium text-white">Ratings</h2>
        {ratingsError && (
          <p className="mb-4 text-sm text-brand-400">{ratingsError}</p>
        )}
        {ratings === null ? (
          !ratingsError && <p className="text-sm text-zinc-500">Loading…</p>
        ) : ratings.length === 0 ? (
          <p className="text-sm text-zinc-500">No ratings yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {ratings.map((rating) => (
              <Card
                key={rating.id}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {"★".repeat(rating.stars)}
                      {"☆".repeat(5 - rating.stars)}
                    </span>
                    <Badge tone="neutral">{rating.subjectType}</Badge>
                  </div>
                  {rating.comment && (
                    <p className="mt-1 text-sm text-zinc-300">
                      {rating.comment}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-600">
                    {new Date(rating.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="danger"
                  disabled={deletingRatingId === rating.id}
                  onClick={() => deleteRating(rating.id)}
                >
                  Delete
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
