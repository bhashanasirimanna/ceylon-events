"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

interface EventListing {
  id: string;
  restaurantId: string;
  title: string;
  startsAt: string;
  status: string;
}

interface RatingSummary {
  average: number | null;
  count: number;
}

interface TierBreakdown {
  ticketTierId: string;
  ticketTierName: string;
  sold: number;
  revenueMinorUnits: number;
}

interface FoodItemSummary {
  menuItemId: string;
  menuItemName: string;
  totalQuantity: number;
}

interface EventReport {
  eventId: string;
  eventTitle: string;
  restaurantId: string;
  startsAt: string;
  ticketsSold: number;
  revenueMinorUnits: number;
  currency: string;
  tierBreakdown: TierBreakdown[];
  foodItemSummary: FoodItemSummary[];
  ratingSummary: RatingSummary;
}

interface RestaurantReportEvent {
  eventId: string;
  eventTitle: string;
  startsAt: string;
  ticketsSold: number;
  revenueMinorUnits: number;
}

interface RestaurantReport {
  restaurantId: string;
  restaurantName: string;
  eventCount: number;
  ticketsSold: number;
  revenueMinorUnits: number;
  currency: string;
  ratingSummary: RatingSummary;
  events: RestaurantReportEvent[];
}

function formatMoney(minorUnits: number, currency: string): string {
  return `${currency} ${(minorUnits / 100).toFixed(2)}`;
}

function formatEventOption(event: EventListing): string {
  return `${event.title} — ${new Date(event.startsAt).toLocaleString()}`;
}

function formatRating(summary: RatingSummary): string {
  if (summary.count === 0 || summary.average === null) {
    return "No ratings yet";
  }
  return `★ ${summary.average.toFixed(1)} (${summary.count} rating${summary.count === 1 ? "" : "s"})`;
}

export default function ReportsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const authorized =
    !!user &&
    (user.roles.includes("RESTAURANT_OWNER") ||
      user.roles.includes("RESTAURANT_STAFF"));

  const [restaurantReport, setRestaurantReport] =
    useState<RestaurantReport | null>(null);
  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventReport, setEventReport] = useState<EventReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventReportError, setEventReportError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!authorized || !user?.restaurantId) return;
    apiFetch<RestaurantReport>(`/reports/restaurants/${user.restaurantId}`)
      .then((report) => setRestaurantReport(report))
      .catch((err) => {
        setError(
          err instanceof ApiError ? err.message : "Failed to load report",
        );
      });
  }, [authorized, user?.restaurantId]);

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

  const loadEventReport = useCallback(async (eventId: string) => {
    setEventReportError(null);
    try {
      const report = await apiFetch<EventReport>(`/reports/events/${eventId}`);
      setEventReport(report);
    } catch (err) {
      setEventReport(null);
      setEventReportError(
        err instanceof ApiError ? err.message : "Failed to load event report",
      );
    }
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    loadEventReport(selectedEventId);
  }, [selectedEventId, loadEventReport]);

  if (isLoading || !user) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!authorized) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-sm text-zinc-500">
            Reports are only available to restaurant owners and staff.
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
          Reports
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Ticket sales, revenue, and ratings across your restaurant and per
          event.
        </p>

        {error && (
          <Card className="mb-4 border-brand-800 bg-brand-600/10">
            <p className="text-sm text-brand-300">{error}</p>
          </Card>
        )}

        {restaurantReport === null ? (
          <p className="mb-6 text-sm text-zinc-500">Loading…</p>
        ) : (
          <Card className="mb-8">
            <h2 className="mb-3 font-medium text-white">
              {restaurantReport.restaurantName}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-zinc-500">Events</p>
                <p className="text-lg font-semibold text-white">
                  {restaurantReport.eventCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Tickets sold</p>
                <p className="text-lg font-semibold text-white">
                  {restaurantReport.ticketsSold}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Revenue</p>
                <p className="text-lg font-semibold text-white">
                  {formatMoney(
                    restaurantReport.revenueMinorUnits,
                    restaurantReport.currency,
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Rating</p>
                <p className="text-lg font-semibold text-white">
                  {formatRating(restaurantReport.ratingSummary)}
                </p>
              </div>
            </div>
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

        {eventReportError && (
          <Card className="mb-4 border-brand-800 bg-brand-600/10">
            <p className="text-sm text-brand-300">{eventReportError}</p>
          </Card>
        )}

        {selectedEventId && !eventReportError && (
          <>
            {eventReport === null ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : (
              <div className="flex flex-col gap-6">
                <Card>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-medium text-white">
                      {eventReport.eventTitle}
                    </h2>
                    <Badge tone="neutral">
                      {new Date(eventReport.startsAt).toLocaleString()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-zinc-500">Tickets sold</p>
                      <p className="text-lg font-semibold text-white">
                        {eventReport.ticketsSold}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Revenue</p>
                      <p className="text-lg font-semibold text-white">
                        {formatMoney(
                          eventReport.revenueMinorUnits,
                          eventReport.currency,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Rating</p>
                      <p className="text-lg font-semibold text-white">
                        {formatRating(eventReport.ratingSummary)}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 className="mb-3 font-medium text-white">
                    Ticket tier breakdown
                  </h3>
                  {eventReport.tierBreakdown.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No tickets sold yet.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 text-left text-zinc-500">
                          <th className="py-2">Tier</th>
                          <th className="py-2 text-right">Sold</th>
                          <th className="py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventReport.tierBreakdown.map((tier) => (
                          <tr
                            key={tier.ticketTierId}
                            className="border-b border-zinc-800"
                          >
                            <td className="py-2 text-white">
                              {tier.ticketTierName}
                            </td>
                            <td className="py-2 text-right text-white">
                              {tier.sold}
                            </td>
                            <td className="py-2 text-right font-medium text-white">
                              {formatMoney(
                                tier.revenueMinorUnits,
                                eventReport.currency,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>

                <Card>
                  <h3 className="mb-3 font-medium text-white">
                    Food pre-orders
                  </h3>
                  {eventReport.foodItemSummary.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No food pre-orders yet.
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
                        {eventReport.foodItemSummary.map((row) => (
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
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
