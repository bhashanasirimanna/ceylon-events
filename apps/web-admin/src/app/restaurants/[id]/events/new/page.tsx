"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, ImageUploader } from "@ceylon/design-system";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { Event } from "@/lib/types";
import type { SeatMap, SeatMapVersion } from "@/lib/seatmap-types";
import { Nav } from "@/components/Nav";

const NO_SEAT_MAP = "__none__";

export default function NewEventPage() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([]);
  const [selectedSeatMapId, setSelectedSeatMapId] = useState(NO_SEAT_MAP);
  const [versions, setVersions] = useState<SeatMapVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSeatMaps = useCallback(async () => {
    try {
      const result = await apiFetch<SeatMap[]>(
        `/seat-maps?restaurantId=${restaurantId}`,
      );
      setSeatMaps(result);
    } catch {
      // Non-fatal: the admin can still create a general-admission event.
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      loadSeatMaps();
    }
  }, [isLoading, user, router, loadSeatMaps]);

  useEffect(() => {
    if (selectedSeatMapId === NO_SEAT_MAP) {
      setVersions([]);
      setSelectedVersionId("");
      return;
    }
    let cancelled = false;
    apiFetch<SeatMapVersion[]>(`/seat-maps/${selectedSeatMapId}/versions`)
      .then((result) => {
        if (cancelled) return;
        setVersions(result);
        setSelectedVersionId(result[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([]);
          setSelectedVersionId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSeatMapId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const event = await apiFetch<Event>("/events", {
        method: "POST",
        body: JSON.stringify({
          restaurantId,
          title,
          description: description || undefined,
          startsAt: new Date(startsAt).toISOString(),
          bannerImageUrl: bannerUrls[0] ?? undefined,
          seatMapVersionId:
            selectedSeatMapId === NO_SEAT_MAP || !selectedVersionId
              ? null
              : selectedVersionId,
        }),
      });
      router.push(`/events/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !user) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-lg px-6 py-10">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">
            New event
          </h1>
          <Link
            href={`/restaurants/${restaurantId}/events`}
            className="text-sm text-brand-600 hover:underline"
          >
            Back to events
          </Link>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && <p className="text-sm text-brand-400">{error}</p>}

            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Title
              <input
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Description
              <textarea
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Cover image
              <ImageUploader
                category="event-banner"
                urls={bannerUrls}
                onChange={setBannerUrls}
                apiFetch={apiFetch}
                maxImages={1}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Starts at
              <input
                type="datetime-local"
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-zinc-300">
              Seat map
              <select
                className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                value={selectedSeatMapId}
                onChange={(e) => setSelectedSeatMapId(e.target.value)}
              >
                <option value={NO_SEAT_MAP}>
                  No seat map (general admission)
                </option>
                {seatMaps.map((sm) => (
                  <option key={sm.id} value={sm.id}>
                    {sm.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedSeatMapId !== NO_SEAT_MAP && (
              <label className="flex flex-col gap-1 text-sm text-zinc-300">
                Published version
                {versions.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    This seat map has no published versions yet — publish it
                    from the seat-map builder first, or choose "No seat map".
                  </p>
                ) : (
                  <select
                    className="rounded-none border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
                    value={selectedVersionId}
                    onChange={(e) => setSelectedVersionId(e.target.value)}
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNumber} — published{" "}
                        {new Date(v.publishedAt).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create event"}
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}
