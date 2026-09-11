"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card } from "@ceylon/design-system";
import { SeatMapStatus } from "@ceylon/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { SeatMap } from "@/lib/seatmap-types";
import { Nav } from "@/components/Nav";

const STATUS_TONE: Record<SeatMapStatus, "warning" | "success"> = {
  [SeatMapStatus.DRAFT]: "warning",
  [SeatMapStatus.PUBLISHED]: "success",
};

export default function RestaurantSeatMapsPage() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [seatMaps, setSeatMaps] = useState<SeatMap[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<SeatMap[]>(
        `/seat-maps?restaurantId=${restaurantId}`,
      );
      setSeatMaps(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load seat maps");
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

  async function createSeatMap(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await apiFetch("/seat-maps", {
        method: "POST",
        body: JSON.stringify({ restaurantId, name, canvasWidth, canvasHeight }),
      });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create seat map");
    } finally {
      setCreating(false);
    }
  }

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Seat maps</h1>
          <Link href="/restaurants" className="text-sm text-brand-600 hover:underline">
            Back to restaurants
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-brand-400">{error}</p>}

        {seatMaps === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="mb-8 flex flex-col gap-3">
            {seatMaps.length === 0 && (
              <p className="text-sm text-zinc-500">No seat maps yet.</p>
            )}
            {seatMaps.map((sm) => (
              <Link key={sm.id} href={`/seat-maps/${sm.id}`}>
                <Card className="flex items-center justify-between hover:border-brand-500">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-white">{sm.name}</h2>
                      <Badge tone={STATUS_TONE[sm.status]}>{sm.status}</Badge>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {sm.canvasWidth} × {sm.canvasHeight}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <Card>
          <h2 className="mb-3 font-medium text-white">+ New seat map</h2>
          <form onSubmit={createSeatMap} className="flex flex-col gap-3">
            <input
              className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              placeholder="Name (e.g. Main Hall)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="flex gap-3">
              <input
                type="number"
                className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                placeholder="Canvas width"
                value={canvasWidth}
                onChange={(e) => setCanvasWidth(Number(e.target.value))}
                min={100}
              />
              <input
                type="number"
                className="w-1/2 rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                placeholder="Canvas height"
                value={canvasHeight}
                onChange={(e) => setCanvasHeight(Number(e.target.value))}
                min={100}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create seat map"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
