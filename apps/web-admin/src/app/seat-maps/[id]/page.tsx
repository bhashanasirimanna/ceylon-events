"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button, Card } from "@ceylon/design-system";
import type { CanvasData } from "@ceylon/seatmap-ui";
import { TableShape } from "@ceylon/shared-types";

// konva/react-konva require browser APIs (and konva's Node entry pulls in
// the native `canvas` package, which isn't installed) — loading this only
// on the client sidesteps SSR entirely rather than fighting webpack
// externals, which don't reliably apply in `next dev`.
const SeatMapCanvas = dynamic(
  () => import("@ceylon/seatmap-ui").then((mod) => mod.SeatMapCanvas),
  { ssr: false },
);
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError } from "@/lib/api-client";
import type {
  SeatMapDefinition,
  SeatMapVersion,
} from "@/lib/seatmap-types";
import { Nav } from "@/components/Nav";

export default function SeatMapBuilderPage() {
  const { id: seatMapId } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [definition, setDefinition] = useState<SeatMapDefinition | null>(null);
  const [versions, setVersions] = useState<SeatMapVersion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [publishedMessage, setPublishedMessage] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const [sectionForm, setSectionForm] = useState({
    name: "",
    x: 40,
    y: 40,
    width: 200,
    height: 150,
    color: "",
  });
  const [tableForm, setTableForm] = useState({
    tableNumber: "",
    x: 200,
    y: 200,
    shape: TableShape.RECT as TableShape,
    capacity: 4,
    sectionId: "",
  });
  const [seatCount, setSeatCount] = useState(4);
  const [seatLabelPrefix, setSeatLabelPrefix] = useState("A");

  const load = useCallback(async () => {
    try {
      const def = await apiFetch<SeatMapDefinition>(`/seat-maps/${seatMapId}`);
      setDefinition(def);
      const v = await apiFetch<SeatMapVersion[]>(
        `/seat-maps/${seatMapId}/versions`,
      );
      setVersions(v);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load seat map");
    }
  }, [seatMapId]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      load();
    }
  }, [isLoading, user, router, load]);

  if (isLoading || !user) {
    return null;
  }

  const canvasData: CanvasData | null = definition
    ? {
        canvasWidth: definition.seatMap.canvasWidth,
        canvasHeight: definition.seatMap.canvasHeight,
        sections: definition.sections,
        tables: definition.tables,
      }
    : null;

  async function handleDragEnd(
    kind: "section" | "table" | "seat",
    id: string,
    x: number,
    y: number,
  ) {
    const path =
      kind === "section" ? `/sections/${id}` : kind === "table" ? `/tables/${id}` : `/seats/${id}`;
    try {
      await apiFetch(path, { method: "PATCH", body: JSON.stringify({ x, y }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to move element");
    }
  }

  async function createSection(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/seat-maps/${seatMapId}/sections`, {
        method: "POST",
        body: JSON.stringify({
          name: sectionForm.name,
          x: sectionForm.x,
          y: sectionForm.y,
          width: sectionForm.width,
          height: sectionForm.height,
          color: sectionForm.color || undefined,
        }),
      });
      setSectionForm({ ...sectionForm, name: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create section");
    }
  }

  async function deleteSection(id: string) {
    if (!confirm("Delete this section? Tables in it become unsectioned.")) return;
    try {
      await apiFetch(`/sections/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete section");
    }
  }

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/seat-maps/${seatMapId}/tables`, {
        method: "POST",
        body: JSON.stringify({
          tableNumber: tableForm.tableNumber,
          x: tableForm.x,
          y: tableForm.y,
          shape: tableForm.shape,
          capacity: tableForm.capacity,
          sectionId: tableForm.sectionId || null,
        }),
      });
      setTableForm({ ...tableForm, tableNumber: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create table");
    }
  }

  async function deleteTable(id: string) {
    if (!confirm("Delete this table and all its seats?")) return;
    try {
      await apiFetch(`/tables/${id}`, { method: "DELETE" });
      if (selectedTableId === id) setSelectedTableId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete table");
    }
  }

  async function addSeatsToSelectedTable(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTableId || !definition) return;
    const table = definition.tables.find((t) => t.id === selectedTableId);
    if (!table) return;
    setError(null);

    // Auto-layout: evenly spaced along a circle around the table center.
    const radius = table.shape === TableShape.CIRCLE ? 55 : 60;
    const seats = Array.from({ length: seatCount }).map((_, i) => {
      const angle = (2 * Math.PI * i) / seatCount;
      return {
        seatLabel: `${seatLabelPrefix}${i + 1}`,
        x: Math.round(table.x + radius * Math.cos(angle)),
        y: Math.round(table.y + radius * Math.sin(angle)),
      };
    });

    try {
      await apiFetch(`/tables/${selectedTableId}/seats`, {
        method: "POST",
        body: JSON.stringify({ seats }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add seats");
    }
  }

  async function publish() {
    setError(null);
    try {
      const version = await apiFetch<SeatMapVersion>(
        `/seat-maps/${seatMapId}/publish`,
        { method: "POST" },
      );
      setPublishedMessage(`Published as version ${version.versionNumber}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish");
    }
  }

  const selectedTable = definition?.tables.find((t) => t.id === selectedTableId);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-neutral-900">
            {definition?.seatMap.name ?? "Seat map"}
          </h1>
          <Button onClick={publish}>Publish</Button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        {publishedMessage && (
          <p className="mb-4 text-sm text-green-700">{publishedMessage}</p>
        )}

        {!canvasData ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex-1 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-2">
              <SeatMapCanvas
                data={canvasData}
                mode="builder"
                onTableClick={(id) => setSelectedTableId(id)}
                onElementDragEnd={handleDragEnd}
              />
            </div>

            <div className="flex w-full flex-col gap-4 lg:w-80">
              <Card>
                <h2 className="mb-3 text-sm font-medium text-neutral-900">
                  + Section
                </h2>
                <form onSubmit={createSection} className="flex flex-col gap-2">
                  <input
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Name"
                    value={sectionForm.name}
                    onChange={(e) =>
                      setSectionForm({ ...sectionForm, name: e.target.value })
                    }
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="x"
                      value={sectionForm.x}
                      onChange={(e) =>
                        setSectionForm({ ...sectionForm, x: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="y"
                      value={sectionForm.y}
                      onChange={(e) =>
                        setSectionForm({ ...sectionForm, y: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="width"
                      value={sectionForm.width}
                      onChange={(e) =>
                        setSectionForm({ ...sectionForm, width: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="height"
                      value={sectionForm.height}
                      onChange={(e) =>
                        setSectionForm({ ...sectionForm, height: Number(e.target.value) })
                      }
                    />
                  </div>
                  <input
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Color (optional, e.g. #fde68a)"
                    value={sectionForm.color}
                    onChange={(e) =>
                      setSectionForm({ ...sectionForm, color: e.target.value })
                    }
                  />
                  <Button type="submit">Add section</Button>
                </form>
                {definition && definition.sections.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1">
                    {definition.sections.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between text-xs text-neutral-600"
                      >
                        {s.name}
                        <button
                          className="text-red-600 hover:underline"
                          onClick={() => deleteSection(s.id)}
                        >
                          delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-medium text-neutral-900">
                  + Table
                </h2>
                <form onSubmit={createTable} className="flex flex-col gap-2">
                  <input
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Table number (e.g. T1)"
                    value={tableForm.tableNumber}
                    onChange={(e) =>
                      setTableForm({ ...tableForm, tableNumber: e.target.value })
                    }
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="x"
                      value={tableForm.x}
                      onChange={(e) =>
                        setTableForm({ ...tableForm, x: Number(e.target.value) })
                      }
                    />
                    <input
                      type="number"
                      className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="y"
                      value={tableForm.y}
                      onChange={(e) =>
                        setTableForm({ ...tableForm, y: Number(e.target.value) })
                      }
                    />
                  </div>
                  <select
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    value={tableForm.shape}
                    onChange={(e) =>
                      setTableForm({
                        ...tableForm,
                        shape: e.target.value as TableShape,
                      })
                    }
                  >
                    <option value={TableShape.RECT}>Rectangle</option>
                    <option value={TableShape.CIRCLE}>Circle</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    placeholder="Capacity"
                    value={tableForm.capacity}
                    onChange={(e) =>
                      setTableForm({ ...tableForm, capacity: Number(e.target.value) })
                    }
                  />
                  <select
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    value={tableForm.sectionId}
                    onChange={(e) =>
                      setTableForm({ ...tableForm, sectionId: e.target.value })
                    }
                  >
                    <option value="">No section</option>
                    {definition?.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit">Add table</Button>
                </form>
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-medium text-neutral-900">
                  + Seats to selected table
                </h2>
                {!selectedTable ? (
                  <p className="text-xs text-neutral-500">
                    Click a table on the canvas to select it.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-neutral-600">
                      Table {selectedTable.tableNumber} — {selectedTable.seats.length}{" "}
                      seat(s) so far
                    </p>
                    <form onSubmit={addSeatsToSelectedTable} className="flex flex-col gap-2">
                      <input
                        type="number"
                        min={1}
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        placeholder="How many seats"
                        value={seatCount}
                        onChange={(e) => setSeatCount(Number(e.target.value))}
                      />
                      <input
                        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        placeholder="Label prefix (e.g. A)"
                        value={seatLabelPrefix}
                        onChange={(e) => setSeatLabelPrefix(e.target.value)}
                      />
                      <Button type="submit">Add seats (auto-arranged)</Button>
                    </form>
                    <button
                      className="mt-2 text-xs text-red-600 hover:underline"
                      onClick={() => deleteTable(selectedTable.id)}
                    >
                      Delete this table
                    </button>
                  </>
                )}
              </Card>

              <Card>
                <h2 className="mb-3 text-sm font-medium text-neutral-900">
                  Version history
                </h2>
                {versions.length === 0 ? (
                  <p className="text-xs text-neutral-500">Not published yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-xs text-neutral-600">
                    {versions.map((v) => (
                      <li key={v.id}>
                        v{v.versionNumber} —{" "}
                        {new Date(v.publishedAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
