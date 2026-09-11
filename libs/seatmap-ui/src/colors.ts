import { SeatStatus } from "@ceylon/shared-types";

// This system's own color source for the canvas (Konva needs plain color
// strings, not Tailwind classes) — kept in step with the "event poster"
// token palette in @ceylon/design-system: brand red for "yours", amber
// for "someone else has it right now", zinc for neutral/unavailable.
export const seatStatusColors: Record<SeatStatus, { fill: string; stroke: string }> = {
  [SeatStatus.AVAILABLE]: { fill: "#27272a", stroke: "#52525b" },
  [SeatStatus.HELD]: { fill: "#f59e0b", stroke: "#b45309" },
  [SeatStatus.HELD_BY_ME]: { fill: "#ef4444", stroke: "#b91c1c" },
  [SeatStatus.SOLD]: { fill: "#3f3f46", stroke: "#18181b" },
};

export const builderColors = {
  section: { fill: "rgba(239, 68, 68, 0.08)", stroke: "#52525b" },
  table: { fill: "#141416", stroke: "#3f3f46" },
  seat: { fill: "#27272a", stroke: "#52525b" },
  selected: { fill: "#ef4444", stroke: "#fca5a5" },
};
