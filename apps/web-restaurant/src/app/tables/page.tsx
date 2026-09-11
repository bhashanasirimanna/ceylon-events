"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { SeatMapSnapshot } from "@ceylon/shared-types";
import type { SeatStatusMap } from "@ceylon/seatmap-ui";
import { Button, Card, QRScanner } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Nav } from "@/components/Nav";

// Same reasoning as the guest seat-picker/checkout pages: konva/react-konva
// need browser APIs, so this only ever loads client-side.
const SeatMapCanvas = dynamic(
  () => import("@ceylon/seatmap-ui").then((mod) => mod.SeatMapCanvas),
  { ssr: false },
);

const AVAILABILITY_POLL_MS = 5000;

interface EventListing {
  id: string;
  restaurantId: string;
  seatMapVersionId: string | null;
  title: string;
  startsAt: string;
  status: string;
}

function formatEventOption(event: EventListing): string {
  return `${event.title} — ${new Date(event.startsAt).toLocaleString()}`;
}

// A physical table QR only ever encodes the table's own id — never an
// eventId (the same table gets reused across different events) and never
// any customer/booking/payment data (the QR is not authorization; the
// logged-in staff account is). Accept either a bare id or a URL ending in
// one, so a QR generated as a deep link still resolves.
function extractTableId(scanned: string): string {
  const trimmed = scanned.trim();
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  } catch {
    return trimmed;
  }
}

export default function StaffTablesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const authorized =
    !!user &&
    (user.roles.includes("RESTAURANT_OWNER") ||
      user.roles.includes("RESTAURANT_STAFF"));

  const [events, setEvents] = useState<EventListing[] | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SeatMapSnapshot | null>(null);
  const [seatStatuses, setSeatStatuses] = useState<SeatStatusMap>({});
  const [error, setError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

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

  const selectedEvent = events?.find((e) => e.id === selectedEventId) ?? null;
  const versionId = selectedEvent?.seatMapVersionId ?? null;

  useEffect(() => {
    if (!versionId) {
      setSnapshot(null);
      return;
    }
    setError(null);
    apiFetch<SeatMapSnapshot>(`/seat-map-versions/${versionId}`)
      .then(setSnapshot)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load table map"),
      );
  }, [versionId]);

  const refreshAvailability = useCallback(async () => {
    if (!versionId) return;
    try {
      const statuses = await apiFetch<SeatStatusMap>(
        `/seat-map-versions/${versionId}/availability`,
      );
      setSeatStatuses(statuses);
    } catch {
      // Transient poll failure — keep showing the last known statuses.
    }
  }, [versionId]);

  useEffect(() => {
    if (!versionId) return;
    refreshAvailability();
    const interval = setInterval(refreshAvailability, AVAILABILITY_POLL_MS);
    return () => clearInterval(interval);
  }, [versionId, refreshAvailability]);

  function openTable(tableId: string) {
    if (!selectedEventId) return;
    router.push(`/tables/${tableId}?eventId=${selectedEventId}`);
  }

  function handleScan(value: string) {
    if (!snapshot) return;
    const tableId = extractTableId(value);
    const table = snapshot.tables.find((t) => t.id === tableId);
    if (!table) {
      setScanError("This QR is not a valid table for the selected event.");
      return;
    }
    setScanError(null);
    openTable(table.id);
  }

  if (authLoading || !user) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!authorized) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-sm text-zinc-500">
            The table floor is only available to restaurant owners and staff.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-black uppercase tracking-tightest text-white">
          Event Floor
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Select a table to see its booking and place or manage food orders.
        </p>

        {error && (
          <Card className="mb-4 border-brand-800 bg-brand-600/10">
            <p className="text-sm text-brand-300">{error}</p>
          </Card>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-400">
            Event:{" "}
            <select
              className="ml-1 rounded-none border border-zinc-700 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={selectedEventId ?? ""}
              onChange={(e) => {
                setSelectedEventId(e.target.value || null);
                setScanMode(false);
              }}
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

          {versionId && (
            <Button
              variant={scanMode ? "primary" : "secondary"}
              onClick={() => setScanMode((prev) => !prev)}
            >
              {scanMode ? "Close scanner" : "Scan table QR"}
            </Button>
          )}
        </div>

        {scanMode && (
          <div className="mb-6">
            <QRScanner onScan={handleScan} className="mx-auto max-w-xs" />
            {scanError && (
              <p className="mt-2 text-center text-sm text-brand-400">{scanError}</p>
            )}
          </div>
        )}

        {!versionId && selectedEvent && (
          <p className="text-sm text-zinc-500">
            This event has no table map.
          </p>
        )}

        {snapshot && (
          <div className="overflow-x-auto border border-zinc-800 bg-surface-raised p-2">
            <SeatMapCanvas
              data={snapshot}
              seatStatuses={seatStatuses}
              mode="picker"
              onTableClick={openTable}
            />
          </div>
        )}
      </main>
    </>
  );
}
