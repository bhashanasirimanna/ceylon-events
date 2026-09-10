import { SeatStatus } from "@ceylon/shared-types";

export const seatStatusColors: Record<SeatStatus, { fill: string; stroke: string }> = {
  [SeatStatus.AVAILABLE]: { fill: "#e2e8f0", stroke: "#94a3b8" },
  [SeatStatus.HELD]: { fill: "#fde68a", stroke: "#d97706" },
  [SeatStatus.HELD_BY_ME]: { fill: "#93c5fd", stroke: "#2563eb" },
  [SeatStatus.SOLD]: { fill: "#fca5a5", stroke: "#dc2626" },
};

export const builderColors = {
  section: { fill: "rgba(148, 163, 184, 0.15)", stroke: "#94a3b8" },
  table: { fill: "#ffffff", stroke: "#334155" },
  seat: { fill: "#e2e8f0", stroke: "#64748b" },
  selected: { fill: "#bfdbfe", stroke: "#2563eb" },
};
