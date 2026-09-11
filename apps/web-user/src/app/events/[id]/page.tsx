"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import type { OfferSnapshot } from "@ceylon/shared-types";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  EventListing,
  RatingSummary,
  Restaurant,
  TicketTier,
} from "@/lib/types";

function discountSummary(offer: OfferSnapshot): string {
  switch (offer.discountType) {
    case "PERCENTAGE":
      return `${offer.discountValue}% off`;
    case "FIXED":
      return `${(offer.discountValue / 100).toFixed(2)} off`;
    case "FREE_ITEM":
      return "Free item";
    default:
      return "";
  }
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });
}

function formatPrice(tier: TicketTier): string {
  return `${tier.currency} ${(tier.priceMinorUnits / 100).toFixed(2)}`;
}

function formatRatingSummary(summary: RatingSummary | null): string | null {
  if (!summary) return null;
  if (summary.count === 0 || summary.average === null) {
    return "No ratings yet";
  }
  return `★ ${summary.average.toFixed(1)} (${summary.count} rating${summary.count === 1 ? "" : "s"})`;
}

function saleWindowNote(tier: TicketTier): string | null {
  const now = Date.now();
  if (tier.saleStartAt && new Date(tier.saleStartAt).getTime() > now) {
    return "Sales not open yet";
  }
  if (tier.saleEndAt && new Date(tier.saleEndAt).getTime() < now) {
    return "Sales closed";
  }
  return null;
}

/** Real countdown to a real timestamp — never a hardcoded/simulated one. */
function useCountdown(targetIso: string): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const target = new Date(targetIso).getTime();
    function tick() {
      const diffMs = target - Date.now();
      if (diffMs <= 0) {
        setLabel(null);
        return;
      }
      const days = Math.floor(diffMs / 86_400_000);
      const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);
      const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
      if (days > 0) setLabel(`${days}d ${hours}h`);
      else if (hours > 0) setLabel(`${hours}h ${minutes}m`);
      else setLabel(`${minutes}m`);
    }
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [targetIso]);

  return label;
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventListing | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [offersByTier, setOffersByTier] = useState<
    Record<string, OfferSnapshot[]>
  >({});
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    apiFetch<EventListing>(`/events/${params.id}`)
      .then(async (e) => {
        setEvent(e);
        const [r, t] = await Promise.all([
          apiFetch<Restaurant>(`/restaurants/${e.restaurantId}`).catch(
            () => null,
          ),
          apiFetch<TicketTier[]>(`/events/${e.id}/ticket-tiers`).catch(
            () => [],
          ),
        ]);
        setRestaurant(r);
        setTiers(t);

        apiFetch<RatingSummary>(
          `/ratings/summary?subjectType=EVENT&subjectId=${e.id}`,
        )
          .then(setRatingSummary)
          .catch(() => setRatingSummary(null));

        const offerEntries = await Promise.all(
          t.map((tier) =>
            apiFetch<OfferSnapshot[]>(`/offers/by-ticket-tier/${tier.id}`)
              .then((offers) => [tier.id, offers] as const)
              .catch(() => [tier.id, []] as const),
          ),
        );
        setOffersByTier(Object.fromEntries(offerEntries));
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load event"),
      )
      .finally(() => setIsLoading(false));
  }, [params.id]);

  const countdown = useCountdown(event?.startsAt ?? new Date().toISOString());

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-zinc-500">Loading…</main>
    );
  }

  if (error || !event) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-brand-400">
        {error ?? "Event not found"}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="relative mb-6 h-64 w-full overflow-hidden bg-surface-raised sm:h-80">
        {event.bannerImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.bannerImageUrl}
            alt=""
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-raised via-transparent to-black/60" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          {countdown && (
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-brand-500">
              Starts in {countdown}
            </p>
          )}
          <h1 className="text-3xl font-black uppercase leading-[0.95] tracking-tightest text-white sm:text-5xl">
            {event.title}
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-sm text-zinc-400">
          {formatDateTime(event.startsAt)}
        </p>
        {formatRatingSummary(ratingSummary) && (
          <span className="text-sm text-zinc-500">
            {formatRatingSummary(ratingSummary)}
          </span>
        )}
      </div>

      {restaurant && (
        <p className="mt-1 text-sm text-zinc-500">
          at{" "}
          <Link
            href={`/restaurants/${restaurant.id}`}
            className="text-brand-500 hover:underline"
          >
            {restaurant.name}
          </Link>
          {" — "}
          {restaurant.address}
        </p>
      )}

      {event.description && (
        <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-zinc-300">
          {event.description}
        </p>
      )}

      <h2 className="mt-10 text-2xl font-black uppercase tracking-tightest text-white">
        Tickets
      </h2>
      {tiers.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          Ticket tiers haven&apos;t been published for this event yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {tiers.map((tier) => {
            const note = saleWindowNote(tier);
            const offers = offersByTier[tier.id] ?? [];
            return (
              <Card key={tier.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-white">{tier.name}</h3>
                    <p className="font-mono text-sm text-zinc-400">
                      {formatPrice(tier)}
                    </p>
                  </div>
                  {note ? (
                    <Badge tone="neutral">{note}</Badge>
                  ) : (
                    <Link href={`/events/${event.id}/checkout/${tier.id}`}>
                      <Button variant="party">Buy</Button>
                    </Link>
                  )}
                </div>
                {offers.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
                    {offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-zinc-300">
                          {offer.name}
                          {offer.description ? ` — ${offer.description}` : ""}
                        </span>
                        <Badge tone="warning">{discountSummary(offer)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
