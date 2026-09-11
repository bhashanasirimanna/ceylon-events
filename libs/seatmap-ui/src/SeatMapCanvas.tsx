"use client";

import { useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Layer, Rect, Circle, Stage, Text, Group } from "react-konva";
import { SeatStatus, TableShape } from "@ceylon/shared-types";
import { builderColors, canvasChrome, seatStatusColors } from "./colors";
import type { CanvasData, SeatStatusMap } from "./types";

export interface SeatMapCanvasProps {
  data: CanvasData;
  /** Omit for builder mode (structural editing, no per-seat status). */
  seatStatuses?: SeatStatusMap;
  mode: "builder" | "picker";
  /** picker mode: disables clicking HELD/SOLD seats belonging to others. */
  onSeatClick?: (seatId: string) => void;
  onTableClick?: (tableId: string) => void;
  onSectionClick?: (sectionId: string) => void;
  /**
   * builder mode: fired after a drag (already snapped to the grid) so the
   * caller can PATCH the new position. Also used internally to replay a
   * reverted position when Undo/Redo is clicked — the caller's own PATCH
   * handler is the single source of truth for persisting a move either way.
   */
  onElementDragEnd?: (
    kind: "section" | "table" | "seat",
    id: string,
    x: number,
    y: number,
  ) => void;
  /**
   * builder mode: shift/ctrl-click adds tables/seats to a multi-selection
   * (highlighted, for a host page to wire batch actions to) without
   * disturbing the existing single-click onTableClick/onSeatClick.
   */
  onSelectionChange?: (selection: { tables: string[]; seats: string[] }) => void;
  /** Shown below the canvas; defaults to on for picker mode (guests need
   * the key), off for builder mode (the surrounding editor already has
   * its own management UI). */
  showLegend?: boolean;
  width?: number;
  height?: number;
}

const SEAT_RADIUS = 12;
const GRID_SIZE = 10;
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

interface Move {
  kind: "section" | "table" | "seat";
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const LEGEND_ITEMS: Array<{ status: SeatStatus; label: string }> = [
  { status: SeatStatus.AVAILABLE, label: "Available" },
  { status: SeatStatus.HELD, label: "Held by someone else" },
  { status: SeatStatus.HELD_BY_ME, label: "Held by you" },
  { status: SeatStatus.SOLD, label: "Sold" },
];

export function SeatMapCanvas({
  data,
  seatStatuses,
  mode,
  onSeatClick,
  onTableClick,
  onSectionClick,
  onElementDragEnd,
  onSelectionChange,
  showLegend = mode === "picker",
  width,
  height,
}: SeatMapCanvasProps) {
  const stageWidth = width ?? data.canvasWidth;
  const stageHeight = height ?? data.canvasHeight;
  const fitScale = Math.min(
    stageWidth / data.canvasWidth,
    stageHeight / data.canvasHeight,
  );

  const [scale, setScale] = useState(fitScale);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const stageRef = useRef<Konva.Stage>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(fitScale);

  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<Move[]>([]);
  const [redoStack, setRedoStack] = useState<Move[]>([]);

  const isBuilder = mode === "builder";

  function emitSelection(tables: Set<string>, seats: Set<string>) {
    onSelectionChange?.({ tables: [...tables], seats: [...seats] });
  }

  function toggleTableSelection(id: string) {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      emitSelection(next, selectedSeats);
      return next;
    });
  }

  function toggleSeatSelection(id: string) {
    setSelectedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      emitSelection(selectedTables, next);
      return next;
    });
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = scale;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clamp(
      oldScale * (direction > 0 ? 1.1 : 1 / 1.1),
      MIN_SCALE,
      MAX_SCALE,
    );

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };
    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }

  function zoomBy(factor: number) {
    setScale((prev) => clamp(prev * factor, MIN_SCALE, MAX_SCALE));
  }

  // Two-finger pinch — the main "touch-friendly" gap for guests on a
  // phone picking their seat, since the wheel handler above only ever
  // fires for a real mouse/trackpad.
  function touchDistance(touches: TouchList): number {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    const dist = touchDistance(touches);
    if (pinchStartDistRef.current === null) {
      pinchStartDistRef.current = dist;
      pinchStartScaleRef.current = scale;
      return;
    }
    const ratio = dist / pinchStartDistRef.current;
    setScale(clamp(pinchStartScaleRef.current * ratio, MIN_SCALE, MAX_SCALE));
  }

  function handleTouchEnd(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length < 2) {
      pinchStartDistRef.current = null;
    }
  }

  function resetView() {
    setScale(fitScale);
    setStagePos({ x: 0, y: 0 });
  }

  function recordMove(move: Move) {
    setHistory((prev) => [...prev, move]);
    setRedoStack([]);
  }

  function handleDragEnd(
    kind: Move["kind"],
    id: string,
    from: { x: number; y: number },
    rawX: number,
    rawY: number,
  ) {
    const to = { x: snap(rawX), y: snap(rawY) };
    recordMove({ kind, id, from, to });
    onElementDragEnd?.(kind, id, to.x, to.y);
  }

  function undo() {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      onElementDragEnd?.(last.kind, last.id, last.from.x, last.from.y);
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      onElementDragEnd?.(last.kind, last.id, last.to.x, last.to.y);
      setHistory((h) => [...h, last]);
      return prev.slice(0, -1);
    });
  }

  const legendEntries = useMemo(
    () =>
      LEGEND_ITEMS.map((item) => ({
        ...item,
        color: seatStatusColors[item.status].fill,
      })),
    [],
  );

  return (
    <div className="inline-flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          aria-label="Zoom in"
          className="h-8 w-8 rounded-none border border-zinc-700 text-base font-bold text-zinc-300 hover:border-brand-500 hover:text-white"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.2)}
          aria-label="Zoom out"
          className="h-8 w-8 rounded-none border border-zinc-700 text-base font-bold text-zinc-300 hover:border-brand-500 hover:text-white"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-none border border-zinc-700 px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest text-zinc-300 hover:border-brand-500 hover:text-white"
        >
          Reset view
        </button>
      </div>

      {isBuilder && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="rounded-none border border-zinc-700 px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest text-zinc-300 hover:border-brand-500 hover:text-white disabled:opacity-30"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            className="rounded-none border border-zinc-700 px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest text-zinc-300 hover:border-brand-500 hover:text-white disabled:opacity-30"
          >
            Redo
          </button>
          {(selectedTables.size > 0 || selectedSeats.size > 0) && (
            <span className="font-mono text-xs text-zinc-500">
              {selectedTables.size + selectedSeats.size} selected
              {" · "}
              <button
                type="button"
                className="underline hover:text-white"
                onClick={() => {
                  setSelectedTables(new Set());
                  setSelectedSeats(new Set());
                  emitSelection(new Set(), new Set());
                }}
              >
                clear
              </button>
            </span>
          )}
        </div>
      )}

      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable
        onDragEnd={(e) => {
          // Konva drag events fire on whichever node is actually being
          // dragged — a section/table/seat drag never triggers the
          // Stage's own onDragEnd, so this only ever fires for a genuine
          // background pan.
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ background: canvasChrome.background, touchAction: "none" }}
      >
        <Layer>
          {data.sections.map((section) => (
            <Group key={section.id}>
              <Rect
                x={section.x}
                y={section.y}
                width={section.width}
                height={section.height}
                fill={section.color ?? builderColors.section.fill}
                stroke={builderColors.section.stroke}
                strokeWidth={1}
                draggable={isBuilder}
                onClick={() => onSectionClick?.(section.id)}
                onDragEnd={(e) =>
                  handleDragEnd(
                    "section",
                    section.id,
                    { x: section.x, y: section.y },
                    e.target.x(),
                    e.target.y(),
                  )
                }
              />
              <Text
                x={section.x + 8}
                y={section.y + 6}
                text={section.name}
                fontSize={13}
                fontStyle="bold"
                fill={canvasChrome.labelSecondary}
                listening={false}
              />
            </Group>
          ))}

          {data.tables.map((table) => {
            const tableSelected = selectedTables.has(table.id);
            const tableColors = tableSelected
              ? builderColors.selected
              : builderColors.table;

            function onTablePointerDown(e: Konva.KonvaEventObject<Event>) {
              const native = e.evt as MouseEvent;
              if (isBuilder && (native.shiftKey || native.ctrlKey || native.metaKey)) {
                toggleTableSelection(table.id);
              } else {
                onTableClick?.(table.id);
              }
            }

            return (
              <Group key={table.id}>
                {table.shape === TableShape.CIRCLE ? (
                  <Circle
                    x={table.x}
                    y={table.y}
                    radius={28}
                    fill={tableColors.fill}
                    stroke={tableColors.stroke}
                    strokeWidth={tableSelected ? 3 : 1.5}
                    draggable={isBuilder}
                    onClick={onTablePointerDown}
                    onTap={onTablePointerDown}
                    onDragEnd={(e) =>
                      handleDragEnd(
                        "table",
                        table.id,
                        { x: table.x, y: table.y },
                        e.target.x(),
                        e.target.y(),
                      )
                    }
                  />
                ) : (
                  <Rect
                    x={table.x - 30}
                    y={table.y - 20}
                    width={60}
                    height={40}
                    fill={tableColors.fill}
                    stroke={tableColors.stroke}
                    strokeWidth={tableSelected ? 3 : 1.5}
                    draggable={isBuilder}
                    onClick={onTablePointerDown}
                    onTap={onTablePointerDown}
                    onDragEnd={(e) =>
                      handleDragEnd(
                        "table",
                        table.id,
                        { x: table.x, y: table.y },
                        e.target.x() + 30,
                        e.target.y() + 20,
                      )
                    }
                  />
                )}
                <Text
                  x={table.x - 20}
                  y={table.y - 6}
                  width={40}
                  align="center"
                  text={table.tableNumber}
                  fontSize={12}
                  fontStyle="bold"
                  fill={canvasChrome.labelPrimary}
                  listening={false}
                />

                {table.seats.map((seat) => {
                  const status = seatStatuses?.[seat.id] ?? SeatStatus.AVAILABLE;
                  const seatSelected = selectedSeats.has(seat.id);
                  const colors = seatSelected
                    ? builderColors.selected
                    : mode === "picker"
                      ? seatStatusColors[status]
                      : builderColors.seat;
                  const clickable =
                    isBuilder ||
                    (mode === "picker" &&
                      (status === SeatStatus.AVAILABLE ||
                        status === SeatStatus.HELD_BY_ME));

                  function onSeatPointerDown(e: Konva.KonvaEventObject<Event>) {
                    const native = e.evt as MouseEvent;
                    if (
                      isBuilder &&
                      (native.shiftKey || native.ctrlKey || native.metaKey)
                    ) {
                      toggleSeatSelection(seat.id);
                      return;
                    }
                    if (clickable) onSeatClick?.(seat.id);
                  }

                  return (
                    <Group key={seat.id}>
                      <Circle
                        x={seat.x}
                        y={seat.y}
                        radius={SEAT_RADIUS}
                        fill={colors.fill}
                        stroke={colors.stroke}
                        strokeWidth={seatSelected ? 3 : 1.5}
                        draggable={isBuilder}
                        onClick={onSeatPointerDown}
                        onTap={onSeatPointerDown}
                        onDragEnd={(e) =>
                          handleDragEnd(
                            "seat",
                            seat.id,
                            { x: seat.x, y: seat.y },
                            e.target.x(),
                            e.target.y(),
                          )
                        }
                      />
                      <Text
                        x={seat.x - SEAT_RADIUS}
                        y={seat.y - 5}
                        width={SEAT_RADIUS * 2}
                        align="center"
                        text={seat.seatLabel}
                        fontSize={9}
                        fill={canvasChrome.labelPrimary}
                        listening={false}
                      />
                    </Group>
                  );
                })}
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {showLegend && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          {legendEntries.map((entry) => (
            <span key={entry.status} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
