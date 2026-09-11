"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

type DiscountType = "PERCENTAGE" | "FIXED" | "FREE_ITEM";
type RedemptionType = "UNLIMITED" | "CAPPED" | "SINGLE_USE";

interface OfferWithRedemptionState {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  redemptionType: RedemptionType;
  redemptionCap: number | null;
  redeemedCount: number;
  remaining: number | null;
}

function discountSummary(offer: OfferWithRedemptionState): string {
  switch (offer.discountType) {
    case "PERCENTAGE":
      return `${offer.discountValue}% off`;
    case "FIXED":
      return `Fixed ${(offer.discountValue / 100).toFixed(2)} off`;
    case "FREE_ITEM":
      return "Free item";
    default:
      return "";
  }
}

function redemptionTypeLabel(type: RedemptionType): string {
  switch (type) {
    case "UNLIMITED":
      return "Unlimited";
    case "CAPPED":
      return "Capped";
    case "SINGLE_USE":
      return "Single use";
    default:
      return type;
  }
}

function stateSummary(offer: OfferWithRedemptionState): string {
  if (offer.redemptionType === "UNLIMITED") {
    return offer.redeemedCount > 0
      ? `Used ${offer.redeemedCount} time${offer.redeemedCount === 1 ? "" : "s"}`
      : "Not yet used";
  }
  if (offer.redemptionType === "SINGLE_USE") {
    return offer.remaining === 0 ? "Already used" : "Not yet used";
  }
  // CAPPED
  return `${offer.remaining} of ${offer.redemptionCap} remaining`;
}

export default function OffersRedemptionPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [token, setToken] = useState("");
  const [offers, setOffers] = useState<OfferWithRedemptionState[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const authorized =
    !!user &&
    (user.roles.includes("RESTAURANT_OWNER") ||
      user.roles.includes("RESTAURANT_STAFF"));

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!isLoading && authorized) {
      inputRef.current?.focus();
    }
  }, [isLoading, authorized]);

  function resetForNextScan() {
    setToken("");
    setOffers(null);
    setNotice(null);
    setError(null);
    setCardErrors({});
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setError(null);
    setNotice(null);
    setOffers(null);
    setCardErrors({});
    setIsLookingUp(true);
    try {
      const result = await apiFetch<OfferWithRedemptionState[]>(
        `/offers/for-ticket/${encodeURIComponent(token.trim())}`,
      );
      setOffers(result);
      if (result.length === 0) {
        setNotice("This ticket has no bundled offers.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setError("Ticket not found — check the code and try again.");
        } else if (err.statusCode === 403) {
          setError("This ticket isn't for an event at your restaurant.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to look up offers");
      }
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleRedeem(offerId: string) {
    setCardErrors((prev) => ({ ...prev, [offerId]: "" }));
    setRedeemingId(offerId);
    try {
      const updated = await apiFetch<OfferWithRedemptionState>(
        `/offers/${offerId}/redeem`,
        { method: "POST", body: JSON.stringify({ qrToken: token.trim() }) },
      );
      setOffers((prev) =>
        prev
          ? prev.map((o) => (o.id === offerId ? updated : o))
          : prev,
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to redeem offer";
      setCardErrors((prev) => ({ ...prev, [offerId]: message }));
    } finally {
      setRedeemingId(null);
    }
  }

  if (isLoading || !user) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!authorized) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-sm text-zinc-500">
            Offer redemption is only available to restaurant owners and staff.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold text-white">
          Offer Redemption
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Scan a ticket&apos;s QR code with a USB scanner (it types into the
          field below like a keyboard) or paste the code manually, then press
          Enter, to see and redeem its bundled perks.
        </p>

        <form onSubmit={handleLookup} className="mb-6 flex gap-2">
          <input
            ref={inputRef}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Scan or paste ticket code"
            autoFocus
            className="flex-1 rounded-none border border-zinc-700 bg-black/40 px-3 py-3 text-base text-white placeholder:text-zinc-500"
          />
          <Button type="submit" disabled={isLookingUp || !token.trim()}>
            {isLookingUp ? "Looking up..." : "Look up"}
          </Button>
        </form>

        {error && (
          <Card className="mb-4 border-brand-800 bg-brand-600/10">
            <p className="text-sm text-brand-300">{error}</p>
          </Card>
        )}

        {notice && (
          <Card className="mb-4">
            <p className="text-sm text-zinc-400">{notice}</p>
          </Card>
        )}

        {offers && offers.length > 0 && (
          <div className="mb-4 flex flex-col gap-3">
            {offers.map((offer) => {
              const fullyUsed = offer.remaining === 0;
              return (
                <Card key={offer.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <h2 className="font-medium text-white">
                      {offer.name}
                    </h2>
                    <Badge tone="neutral">
                      {redemptionTypeLabel(offer.redemptionType)}
                    </Badge>
                  </div>
                  {offer.description && (
                    <p className="mb-1 text-sm text-zinc-400">
                      {offer.description}
                    </p>
                  )}
                  <p className="text-sm font-medium text-brand-600">
                    {discountSummary(offer)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {stateSummary(offer)}
                  </p>

                  {cardErrors[offer.id] && (
                    <p className="mt-2 text-sm text-brand-400">
                      {cardErrors[offer.id]}
                    </p>
                  )}

                  {!fullyUsed && (
                    <Button
                      className="mt-3 w-full"
                      disabled={redeemingId === offer.id}
                      onClick={() => handleRedeem(offer.id)}
                    >
                      {redeemingId === offer.id ? "Redeeming..." : "Redeem"}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {(offers || error) && (
          <Button variant="secondary" className="w-full" onClick={resetForNextScan}>
            Scan next ticket
          </Button>
        )}
      </main>
    </>
  );
}
