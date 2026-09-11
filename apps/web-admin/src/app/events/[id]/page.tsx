"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, ImageUploader } from "@ceylon/design-system";
import { DiscountType, EventStatus, RedemptionType } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  Event,
  EventReport,
  Offer,
  OfferRedemption,
  PromoCode,
  TicketTier,
} from "@/lib/types";
import { Nav } from "@/components/Nav";

function formatDiscount(discountType: DiscountType, discountValue: number): string {
  if (discountType === DiscountType.PERCENTAGE) return `${discountValue}% off`;
  if (discountType === DiscountType.FIXED)
    return `Fixed ${(discountValue / 100).toFixed(2)} off`;
  return "Free item";
}

function formatRedemption(offer: Offer): string {
  if (offer.redemptionType === RedemptionType.UNLIMITED) return "Unlimited";
  if (offer.redemptionType === RedemptionType.SINGLE_USE) return "Single use";
  return `Up to ${offer.redemptionCap} uses`;
}

const STATUS_TONE: Record<EventStatus, "neutral" | "success" | "danger"> = {
  [EventStatus.DRAFT]: "neutral",
  [EventStatus.PUBLISHED]: "success",
  [EventStatus.CANCELLED]: "danger",
  [EventStatus.COMPLETED]: "neutral",
};

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export default function EventManagePage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusActioning, setStatusActioning] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [tierName, setTierName] = useState("");
  const [tierPrice, setTierPrice] = useState("");
  const [tierCurrency, setTierCurrency] = useState("LKR");
  const [tierSaleStart, setTierSaleStart] = useState("");
  const [tierSaleEnd, setTierSaleEnd] = useState("");
  const [tierQuantityLimit, setTierQuantityLimit] = useState("");
  const [creatingTier, setCreatingTier] = useState(false);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerName, setOfferName] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerDiscountType, setOfferDiscountType] = useState<DiscountType>(
    DiscountType.PERCENTAGE,
  );
  const [offerDiscountValue, setOfferDiscountValue] = useState("");
  const [offerRedemptionType, setOfferRedemptionType] = useState<RedemptionType>(
    RedemptionType.UNLIMITED,
  );
  const [offerRedemptionCap, setOfferRedemptionCap] = useState("");
  const [offerTierIds, setOfferTierIds] = useState<string[]>([]);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [offerRedemptions, setOfferRedemptions] = useState<
    Record<string, OfferRedemption[]>
  >({});

  const [report, setReport] = useState<EventReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscountType, setPromoDiscountType] = useState<DiscountType>(
    DiscountType.PERCENTAGE,
  );
  const [promoDiscountValue, setPromoDiscountValue] = useState("");
  const [promoTierId, setPromoTierId] = useState("");
  const [promoUsageLimit, setPromoUsageLimit] = useState("");
  const [promoExpiresAt, setPromoExpiresAt] = useState("");
  const [creatingPromo, setCreatingPromo] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eventResult, tiersResult, offersResult, promoCodesResult] =
        await Promise.all([
          apiFetch<Event>(`/events/${eventId}`),
          apiFetch<TicketTier[]>(`/events/${eventId}/ticket-tiers`),
          apiFetch<Offer[]>(`/offers?eventId=${eventId}`),
          apiFetch<PromoCode[]>(`/promo-codes?eventId=${eventId}`),
        ]);
      setEvent(eventResult);
      setTiers(tiersResult);
      setOffers(offersResult);
      setPromoCodes(promoCodesResult);
      setEditTitle(eventResult.title);
      setEditDescription(eventResult.description ?? "");
      setEditStartsAt(toDateTimeLocal(eventResult.startsAt));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load event");
    }
  }, [eventId]);

  const loadReport = useCallback(async () => {
    try {
      const result = await apiFetch<EventReport>(`/reports/events/${eventId}`);
      setReport(result);
    } catch (err) {
      setReportError(
        err instanceof ApiError ? err.message : "Failed to load report",
      );
    }
  }, [eventId]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      load();
      loadReport();
    }
  }, [isLoading, user, router, load, loadReport]);

  async function setStatus(status: EventStatus) {
    setStatusActioning(true);
    setError(null);
    try {
      await apiFetch(`/events/${eventId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setStatusActioning(false);
    }
  }

  async function updateBanner(urls: string[]) {
    setError(null);
    try {
      await apiFetch(`/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({ bannerImageUrl: urls[0] ?? null }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update cover image");
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    setError(null);
    try {
      await apiFetch(`/events/${eventId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || undefined,
          startsAt: new Date(editStartsAt).toISOString(),
        }),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save changes");
    } finally {
      setSavingEdit(false);
    }
  }

  async function createTier(e: React.FormEvent) {
    e.preventDefault();
    setCreatingTier(true);
    setError(null);
    try {
      await apiFetch(`/events/${eventId}/ticket-tiers`, {
        method: "POST",
        body: JSON.stringify({
          name: tierName,
          priceMinorUnits: Math.round(Number(tierPrice) * 100),
          currency: tierCurrency,
          saleStartAt: tierSaleStart
            ? new Date(tierSaleStart).toISOString()
            : null,
          saleEndAt: tierSaleEnd ? new Date(tierSaleEnd).toISOString() : null,
          quantityLimit: tierQuantityLimit ? Number(tierQuantityLimit) : null,
        }),
      });
      setTierName("");
      setTierPrice("");
      setTierSaleStart("");
      setTierSaleEnd("");
      setTierQuantityLimit("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create ticket tier");
    } finally {
      setCreatingTier(false);
    }
  }

  async function deleteTier(id: string) {
    if (!confirm("Delete this ticket tier?")) return;
    setError(null);
    try {
      await apiFetch(`/ticket-tiers/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete ticket tier");
    }
  }

  function toggleOfferTier(tierId: string) {
    setOfferTierIds((current) =>
      current.includes(tierId)
        ? current.filter((id) => id !== tierId)
        : [...current, tierId],
    );
  }

  async function createOffer(e: React.FormEvent) {
    e.preventDefault();
    if (offerTierIds.length === 0) {
      setError("Select at least one ticket tier for this offer");
      return;
    }
    setCreatingOffer(true);
    setError(null);
    try {
      await apiFetch("/offers", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          name: offerName,
          description: offerDescription || undefined,
          discountType: offerDiscountType,
          discountValue:
            offerDiscountType === DiscountType.FIXED
              ? Math.round(Number(offerDiscountValue) * 100)
              : Number(offerDiscountValue) || 0,
          redemptionType: offerRedemptionType,
          redemptionCap:
            offerRedemptionType === RedemptionType.CAPPED
              ? Number(offerRedemptionCap)
              : undefined,
          ticketTierIds: offerTierIds,
        }),
      });
      setOfferName("");
      setOfferDescription("");
      setOfferDiscountValue("");
      setOfferRedemptionCap("");
      setOfferTierIds([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create offer");
    } finally {
      setCreatingOffer(false);
    }
  }

  async function deleteOffer(id: string) {
    if (!confirm("Delete this offer?")) return;
    setError(null);
    try {
      await apiFetch(`/offers/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete offer");
    }
  }

  async function loadRedemptions(offerId: string) {
    if (offerRedemptions[offerId]) {
      setOfferRedemptions((current) => {
        const next = { ...current };
        delete next[offerId];
        return next;
      });
      return;
    }
    try {
      const redemptions = await apiFetch<OfferRedemption[]>(
        `/offers/${offerId}/redemptions`,
      );
      setOfferRedemptions((current) => ({ ...current, [offerId]: redemptions }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load redemptions");
    }
  }

  async function createPromoCode(e: React.FormEvent) {
    e.preventDefault();
    setCreatingPromo(true);
    setError(null);
    try {
      await apiFetch("/promo-codes", {
        method: "POST",
        body: JSON.stringify({
          eventId,
          code: promoCode,
          discountType: promoDiscountType,
          discountValue:
            promoDiscountType === DiscountType.FIXED
              ? Math.round(Number(promoDiscountValue) * 100)
              : Number(promoDiscountValue) || 0,
          applicableTicketTierId: promoTierId || undefined,
          usageLimit: promoUsageLimit ? Number(promoUsageLimit) : undefined,
          expiresAt: promoExpiresAt
            ? new Date(promoExpiresAt).toISOString()
            : undefined,
        }),
      });
      setPromoCode("");
      setPromoDiscountValue("");
      setPromoTierId("");
      setPromoUsageLimit("");
      setPromoExpiresAt("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create promo code");
    } finally {
      setCreatingPromo(false);
    }
  }

  async function togglePromoActive(promo: PromoCode) {
    setError(null);
    try {
      await apiFetch(`/promo-codes/${promo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update promo code");
    }
  }

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        {error && <p className="mb-4 text-sm text-brand-400">{error}</p>}

        {!event ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <>
            <div className="mb-6">
              <Link
                href={`/restaurants/${event.restaurantId}/events`}
                className="text-sm text-brand-600 hover:underline"
              >
                Back to events
              </Link>
            </div>

            <Card className="mb-6">
              {event.bannerImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.bannerImageUrl}
                  alt=""
                  className="mb-3 h-40 w-full rounded-none object-cover"
                />
              )}
              <div className="mb-3">
                <span className="mb-1 block text-xs font-medium text-zinc-500">
                  Cover image
                </span>
                <ImageUploader
                  category="event-banner"
                  urls={event.bannerImageUrl ? [event.bannerImageUrl] : []}
                  onChange={updateBanner}
                  apiFetch={apiFetch}
                  maxImages={1}
                />
              </div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-white">
                    {event.title}
                  </h1>
                  <Badge tone={STATUS_TONE[event.status]}>{event.status}</Badge>
                </div>
                <div className="flex gap-2">
                  {event.status === EventStatus.DRAFT && (
                    <Button
                      disabled={statusActioning}
                      onClick={() => setStatus(EventStatus.PUBLISHED)}
                    >
                      Publish
                    </Button>
                  )}
                  {event.status === EventStatus.PUBLISHED && (
                    <Button
                      variant="secondary"
                      disabled={statusActioning}
                      onClick={() => setStatus(EventStatus.COMPLETED)}
                    >
                      Mark completed
                    </Button>
                  )}
                  {(event.status === EventStatus.DRAFT ||
                    event.status === EventStatus.PUBLISHED) && (
                    <Button
                      variant="danger"
                      disabled={statusActioning}
                      onClick={() => setStatus(EventStatus.CANCELLED)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {!editing ? (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-zinc-500">
                    {new Date(event.startsAt).toLocaleString()}
                  </p>
                  {event.description && (
                    <p className="text-sm text-zinc-300">
                      {event.description}
                    </p>
                  )}
                  <button
                    className="mt-2 self-start text-sm text-brand-600 hover:underline"
                    onClick={() => setEditing(true)}
                  >
                    Edit details
                  </button>
                </div>
              ) : (
                <form onSubmit={saveEdit} className="flex flex-col gap-3">
                  <input
                    className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                  <textarea
                    className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                  <input
                    type="datetime-local"
                    className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    value={editStartsAt}
                    onChange={(e) => setEditStartsAt(e.target.value)}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={savingEdit}>
                      {savingEdit ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>

            <h2 className="mb-3 font-medium text-white">
              Ticket tiers
            </h2>

            <div className="mb-6 flex flex-col gap-3">
              {tiers.length === 0 && (
                <p className="text-sm text-zinc-500">
                  No ticket tiers yet.
                </p>
              )}
              {tiers.map((tier) => (
                <Card key={tier.id} className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">
                      {tier.name}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {tier.currency} {(tier.priceMinorUnits / 100).toFixed(2)}
                      {tier.quantityLimit !== null &&
                        ` · limit ${tier.quantityLimit}`}
                    </p>
                    {(tier.saleStartAt || tier.saleEndAt) && (
                      <p className="text-xs text-zinc-600">
                        Sale window:{" "}
                        {tier.saleStartAt
                          ? new Date(tier.saleStartAt).toLocaleString()
                          : "now"}{" "}
                        –{" "}
                        {tier.saleEndAt
                          ? new Date(tier.saleEndAt).toLocaleString()
                          : "no end"}
                      </p>
                    )}
                  </div>
                  <Button variant="danger" onClick={() => deleteTier(tier.id)}>
                    Delete
                  </Button>
                </Card>
              ))}
            </div>

            <Card>
              <h3 className="mb-3 font-medium text-white">
                + Add ticket tier
              </h3>
              <form onSubmit={createTier} className="flex flex-col gap-3">
                <input
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                  placeholder="Name (e.g. General, VIP)"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  required
                />
                <div className="flex gap-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-2/3 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    placeholder="Price"
                    value={tierPrice}
                    onChange={(e) => setTierPrice(e.target.value)}
                    required
                  />
                  <input
                    className="w-1/3 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    placeholder="Currency"
                    value={tierCurrency}
                    onChange={(e) => setTierCurrency(e.target.value)}
                    maxLength={3}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <label className="flex w-1/2 flex-col gap-1 text-xs text-zinc-500">
                    Sale starts (optional)
                    <input
                      type="datetime-local"
                      className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                      value={tierSaleStart}
                      onChange={(e) => setTierSaleStart(e.target.value)}
                    />
                  </label>
                  <label className="flex w-1/2 flex-col gap-1 text-xs text-zinc-500">
                    Sale ends (optional)
                    <input
                      type="datetime-local"
                      className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                      value={tierSaleEnd}
                      onChange={(e) => setTierSaleEnd(e.target.value)}
                    />
                  </label>
                </div>
                <input
                  type="number"
                  min="1"
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                  placeholder="Quantity limit (optional)"
                  value={tierQuantityLimit}
                  onChange={(e) => setTierQuantityLimit(e.target.value)}
                />
                <Button type="submit" disabled={creatingTier}>
                  {creatingTier ? "Adding…" : "Add ticket tier"}
                </Button>
              </form>
            </Card>

            <h2 className="mb-3 mt-8 font-medium text-white">Offers</h2>

            <div className="mb-6 flex flex-col gap-3">
              {offers.length === 0 && (
                <p className="text-sm text-zinc-500">No offers yet.</p>
              )}
              {offers.map((offer) => (
                <Card key={offer.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">
                          {offer.name}
                        </h3>
                        <Badge tone="success">
                          {formatDiscount(offer.discountType, offer.discountValue)}
                        </Badge>
                        <Badge tone="neutral">{formatRedemption(offer)}</Badge>
                      </div>
                      {offer.description && (
                        <p className="text-sm text-zinc-500">
                          {offer.description}
                        </p>
                      )}
                      <p className="text-xs text-zinc-600">
                        Tiers:{" "}
                        {offer.ticketTierIds
                          .map(
                            (tid) => tiers.find((t) => t.id === tid)?.name ?? tid,
                          )
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => loadRedemptions(offer.id)}
                      >
                        {offerRedemptions[offer.id] ? "Hide" : "View"} redemptions
                      </Button>
                      <Button variant="danger" onClick={() => deleteOffer(offer.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  {offerRedemptions[offer.id] && (
                    <div className="mt-3 border-t border-zinc-800 pt-3 text-sm text-zinc-400">
                      {offerRedemptions[offer.id].length === 0 ? (
                        <p>No redemptions yet.</p>
                      ) : (
                        <p>
                          {offerRedemptions[offer.id].length} redemption(s) —
                          most recent{" "}
                          {new Date(
                            offerRedemptions[offer.id][0].redeemedAt,
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <Card className="mb-8">
              <h3 className="mb-3 font-medium text-white">+ Add offer</h3>
              <form onSubmit={createOffer} className="flex flex-col gap-3">
                <input
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                  placeholder="Name (e.g. Unlimited Beer)"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                  required
                />
                <textarea
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                  rows={2}
                  placeholder="Description (optional)"
                  value={offerDescription}
                  onChange={(e) => setOfferDescription(e.target.value)}
                />
                <div className="flex gap-3">
                  <select
                    className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    value={offerDiscountType}
                    onChange={(e) =>
                      setOfferDiscountType(e.target.value as DiscountType)
                    }
                  >
                    <option value={DiscountType.PERCENTAGE}>Percentage</option>
                    <option value={DiscountType.FIXED}>Fixed amount</option>
                    <option value={DiscountType.FREE_ITEM}>Free item</option>
                  </select>
                  {offerDiscountType !== DiscountType.FREE_ITEM && (
                    <input
                      type="number"
                      step={offerDiscountType === DiscountType.FIXED ? "0.01" : "1"}
                      min="0"
                      className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                      placeholder={
                        offerDiscountType === DiscountType.PERCENTAGE
                          ? "% off"
                          : "Amount off"
                      }
                      value={offerDiscountValue}
                      onChange={(e) => setOfferDiscountValue(e.target.value)}
                      required
                    />
                  )}
                </div>
                <div className="flex gap-3">
                  <select
                    className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    value={offerRedemptionType}
                    onChange={(e) =>
                      setOfferRedemptionType(e.target.value as RedemptionType)
                    }
                  >
                    <option value={RedemptionType.UNLIMITED}>Unlimited</option>
                    <option value={RedemptionType.CAPPED}>Capped</option>
                    <option value={RedemptionType.SINGLE_USE}>Single use</option>
                  </select>
                  {offerRedemptionType === RedemptionType.CAPPED && (
                    <input
                      type="number"
                      min="1"
                      className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                      placeholder="Max uses per ticket"
                      value={offerRedemptionCap}
                      onChange={(e) => setOfferRedemptionCap(e.target.value)}
                      required
                    />
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs text-zinc-500">
                    Applies to ticket tiers:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {tiers.map((tier) => (
                      <label
                        key={tier.id}
                        className="flex items-center gap-1 text-sm text-zinc-300"
                      >
                        <input
                          type="checkbox"
                          checked={offerTierIds.includes(tier.id)}
                          onChange={() => toggleOfferTier(tier.id)}
                        />
                        {tier.name}
                      </label>
                    ))}
                    {tiers.length === 0 && (
                      <p className="text-sm text-zinc-600">
                        Add a ticket tier first.
                      </p>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={creatingOffer}>
                  {creatingOffer ? "Adding…" : "Add offer"}
                </Button>
              </form>
            </Card>

            <h2 className="mb-3 font-medium text-white">Promo codes</h2>

            <div className="mb-6 flex flex-col gap-3">
              {promoCodes.length === 0 && (
                <p className="text-sm text-zinc-500">No promo codes yet.</p>
              )}
              {promoCodes.map((promo) => (
                <Card
                  key={promo.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono font-medium text-white">
                        {promo.code}
                      </h3>
                      <Badge tone={promo.isActive ? "success" : "danger"}>
                        {promo.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {formatDiscount(promo.discountType, promo.discountValue)}
                      {promo.applicableTicketTierId
                        ? ` · ${
                            tiers.find((t) => t.id === promo.applicableTicketTierId)
                              ?.name ?? "one tier"
                          } only`
                        : " · order-wide"}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Used {promo.usageCount}
                      {promo.usageLimit !== null ? ` / ${promo.usageLimit}` : ""}
                      {promo.expiresAt &&
                        ` · expires ${new Date(promo.expiresAt).toLocaleString()}`}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => togglePromoActive(promo)}>
                    {promo.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </Card>
              ))}
            </div>

            <Card>
              <h3 className="mb-3 font-medium text-white">
                + Add promo code
              </h3>
              <form onSubmit={createPromoCode} className="flex flex-col gap-3">
                <input
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 uppercase"
                  placeholder="Code (e.g. EARLY20)"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  required
                />
                <div className="flex gap-3">
                  <select
                    className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    value={promoDiscountType}
                    onChange={(e) =>
                      setPromoDiscountType(e.target.value as DiscountType)
                    }
                  >
                    <option value={DiscountType.PERCENTAGE}>Percentage</option>
                    <option value={DiscountType.FIXED}>Fixed amount</option>
                  </select>
                  <input
                    type="number"
                    step={promoDiscountType === DiscountType.FIXED ? "0.01" : "1"}
                    min="0"
                    className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    placeholder={
                      promoDiscountType === DiscountType.PERCENTAGE
                        ? "% off"
                        : "Amount off"
                    }
                    value={promoDiscountValue}
                    onChange={(e) => setPromoDiscountValue(e.target.value)}
                    required
                  />
                </div>
                <select
                  className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                  value={promoTierId}
                  onChange={(e) => setPromoTierId(e.target.value)}
                >
                  <option value="">Order-wide</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} only
                    </option>
                  ))}
                </select>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min="1"
                    className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    placeholder="Usage limit (optional)"
                    value={promoUsageLimit}
                    onChange={(e) => setPromoUsageLimit(e.target.value)}
                  />
                  <input
                    type="datetime-local"
                    className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    value={promoExpiresAt}
                    onChange={(e) => setPromoExpiresAt(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={creatingPromo}>
                  {creatingPromo ? "Adding…" : "Add promo code"}
                </Button>
              </form>
            </Card>

            <h2 className="mb-3 mt-8 font-medium text-white">Report</h2>
            {reportError && (
              <p className="mb-4 text-sm text-brand-400">{reportError}</p>
            )}
            {report === null ? (
              !reportError && (
                <p className="text-sm text-zinc-500">Loading…</p>
              )
            ) : (
              <Card>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-zinc-500">Tickets sold</p>
                    <p className="text-lg font-semibold text-white">
                      {report.ticketsSold}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Revenue</p>
                    <p className="text-lg font-semibold text-white">
                      {report.currency}{" "}
                      {(report.revenueMinorUnits / 100).toFixed(2)}
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

                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <h3 className="mb-2 text-sm font-medium text-white">
                    Ticket tier breakdown
                  </h3>
                  {report.tierBreakdown.length === 0 ? (
                    <p className="text-sm text-zinc-500">No sales yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs text-zinc-500">
                            <th className="pb-2 font-medium">Tier</th>
                            <th className="pb-2 font-medium">Sold</th>
                            <th className="pb-2 font-medium">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.tierBreakdown.map((tier) => (
                            <tr
                              key={tier.ticketTierId}
                              className="border-t border-zinc-800"
                            >
                              <td className="py-2">{tier.ticketTierName}</td>
                              <td className="py-2">{tier.sold}</td>
                              <td className="py-2">
                                {report.currency}{" "}
                                {(tier.revenueMinorUnits / 100).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <h3 className="mb-2 text-sm font-medium text-white">
                    Food item summary
                  </h3>
                  {report.foodItemSummary.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No food pre-orders yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs text-zinc-500">
                            <th className="pb-2 font-medium">Item</th>
                            <th className="pb-2 font-medium">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.foodItemSummary.map((item) => (
                            <tr
                              key={item.menuItemId}
                              className="border-t border-zinc-800"
                            >
                              <td className="py-2">{item.menuItemName}</td>
                              <td className="py-2">{item.totalQuantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
