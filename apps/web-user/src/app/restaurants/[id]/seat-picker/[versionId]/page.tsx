"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { SeatStatusMap } from "@ceylon/seatmap-ui";
import type { SeatMapSnapshot } from "@ceylon/shared-types";
import { SeatStatus } from "@ceylon/shared-types";
import { Button, Card } from "@ceylon/design-system";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// konva/react-konva require browser APIs (and konva's Node entry pulls in
// the native `canvas` package, which isn't installed) — loading this only
// on the client sidesteps SSR entirely rather than fighting webpack
// externals, which don't reliably apply in `next dev`.
const SeatMapCanvas = dynamic(
  () => import("@ceylon/seatmap-ui").then((mod) => mod.SeatMapCanvas),
  { ssr: false },
);

interface HoldResponse {
  seatId: string;
  holderToken: string;
  expiresAt: string;
}

interface StoredHold {
  seatId: string;
  holderToken: string;
  expiresAt: string;
}

const AVAILABILITY_POLL_MS = 5000;

function holdStorageKey(versionId: string): string {
  return `ceylon_seat_hold_${versionId}`;
}

function loadStoredHold(versionId: string): StoredHold | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(holdStorageKey(versionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredHold;
  } catch {
    return null;
  }
}

function saveStoredHold(versionId: string, hold: StoredHold | null): void {
  if (typeof window === "undefined") return;
  if (hold) {
    window.localStorage.setItem(holdStorageKey(versionId), JSON.stringify(hold));
  } else {
    window.localStorage.removeItem(holdStorageKey(versionId));
  }
}

function formatCountdown(expiresAt: string): string {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) return "0:00";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SeatPickerPage() {
  const params = useParams<{ id: string; versionId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [snapshot, setSnapshot] = useState<SeatMapSnapshot | null>(null);
  const [seatStatuses, setSeatStatuses] = useState<SeatStatusMap>({});
  const [hold, setHold] = useState<StoredHold | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, forceTick] = useState(0);

  const holdRef = useRef<StoredHold | null>(null);
  holdRef.current = hold;

  const versionId = params.versionId;
  const restaurantId = params.id;

  const refreshAvailability = useCallback(async () => {
    if (!versionId) return;
    const query = holdRef.current?.holderToken
      ? `?holderToken=${encodeURIComponent(holdRef.current.holderToken)}`
      : "";
    try {
      const statuses = await apiFetch<SeatStatusMap>(
        `/seat-map-versions/${versionId}/availability${query}`,
      );
      setSeatStatuses(statuses);
    } catch {
      // Transient poll failure — keep showing the last known statuses.
    }
  }, [versionId]);

  useEffect(() => {
    if (!versionId) return;
    setHold(loadStoredHold(versionId));

    apiFetch<SeatMapSnapshot>(`/seat-map-versions/${versionId}`)
      .then((snap) => setSnapshot(snap))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Failed to load seat map"),
      )
      .finally(() => setIsLoading(false));
  }, [versionId]);

  useEffect(() => {
    refreshAvailability();
    const interval = setInterval(refreshAvailability, AVAILABILITY_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshAvailability]);

  useEffect(() => {
    if (!hold) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [hold]);

  async function handleSeatClick(seatId: string) {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (hold?.seatId === seatId) return;

    setError(null);
    try {
      if (hold) {
        await apiFetch(`/seat-map-versions/${versionId}/holds/${hold.seatId}`, {
          method: "DELETE",
          body: JSON.stringify({ holderToken: hold.holderToken }),
        });
      }
      const result = await apiFetch<HoldResponse>(
        `/seat-map-versions/${versionId}/holds`,
        { method: "POST", body: JSON.stringify({ seatId }) },
      );
      const newHold: StoredHold = {
        seatId: result.seatId,
        holderToken: result.holderToken,
        expiresAt: result.expiresAt,
      };
      setHold(newHold);
      saveStoredHold(versionId, newHold);
      await refreshAvailability();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("Someone just took this seat.");
        await refreshAvailability();
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to hold seat");
      }
    }
  }

  async function handleRelease() {
    if (!hold) return;
    setError(null);
    try {
      await apiFetch(`/seat-map-versions/${versionId}/holds/${hold.seatId}`, {
        method: "DELETE",
        body: JSON.stringify({ holderToken: hold.holderToken }),
      });
      setHold(null);
      saveStoredHold(versionId, null);
      await refreshAvailability();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to release seat");
    }
  }

  async function handleRenew() {
    if (!hold) return;
    setError(null);
    try {
      const result = await apiFetch<HoldResponse>(
        `/seat-map-versions/${versionId}/holds/${hold.seatId}/renew`,
        { method: "POST", body: JSON.stringify({ holderToken: hold.holderToken }) },
      );
      const renewed: StoredHold = {
        seatId: result.seatId,
        holderToken: result.holderToken,
        expiresAt: result.expiresAt,
      };
      setHold(renewed);
      saveStoredHold(versionId, renewed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to renew hold");
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        setHold(null);
        saveStoredHold(versionId, null);
      }
    }
  }

  if (isLoading) {
    return <main className="mx-auto max-w-5xl px-4 py-8">Loading…</main>;
  }

  if (error && !snapshot) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-red-600">{error}</main>
    );
  }

  if (!snapshot) {
    return null;
  }

  const heldSeatLabel = hold
    ? snapshot.tables
        .flatMap((t) => t.seats)
        .find((s) => s.id === hold.seatId)?.seatLabel
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 rounded-lg border border-brand-300 bg-brand-50 p-4 text-sm text-brand-700">
        Preview — full ticket checkout arrives in a later phase. This
        demonstrates the seat hold mechanism only.
      </div>

      <h1 className="text-xl font-semibold text-neutral-900">
        {snapshot.name}
      </h1>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 bg-white p-2">
        <SeatMapCanvas
          data={snapshot}
          seatStatuses={seatStatuses}
          mode="picker"
          onSeatClick={handleSeatClick}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#e2e8f0]" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#fde68a]" />
          Held by someone else
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#93c5fd]" />
          Held by you
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-[#fca5a5]" />
          Sold
        </span>
      </div>

      {hold && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-neutral-900">
              Holding seat {heldSeatLabel ?? hold.seatId}
            </p>
            <p className="text-sm text-neutral-500">
              Hold expires in {formatCountdown(hold.expiresAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleRenew}>
              Renew hold
            </Button>
            <Button variant="danger" onClick={handleRelease}>
              Release seat
            </Button>
          </div>
        </Card>
      )}

      {!user && !authLoading && (
        <p className="mt-6 text-sm text-neutral-500">
          Log in to hold a seat — browsing is open to everyone.
        </p>
      )}

      <p className="mt-6 text-sm text-neutral-500">
        Seat map for restaurant {restaurantId}
      </p>
    </main>
  );
}
