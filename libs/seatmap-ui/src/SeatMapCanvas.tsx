"use client";

import { Layer, Rect, Circle, Stage, Text, Group } from "react-konva";
import { SeatStatus, TableShape } from "@ceylon/shared-types";
import { builderColors, seatStatusColors } from "./colors";
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
  /** builder mode: fired on drag end so the caller can PATCH the new position. */
  onElementDragEnd?: (
    kind: "section" | "table" | "seat",
    id: string,
    x: number,
    y: number,
  ) => void;
  width?: number;
  height?: number;
}

const SEAT_RADIUS = 12;

export function SeatMapCanvas({
  data,
  seatStatuses,
  mode,
  onSeatClick,
  onTableClick,
  onSectionClick,
  onElementDragEnd,
  width,
  height,
}: SeatMapCanvasProps) {
  const stageWidth = width ?? data.canvasWidth;
  const stageHeight = height ?? data.canvasHeight;
  const scale = Math.min(stageWidth / data.canvasWidth, stageHeight / data.canvasHeight);

  return (
    <Stage
      width={data.canvasWidth * scale}
      height={data.canvasHeight * scale}
      scaleX={scale}
      scaleY={scale}
      style={{ background: "#f8fafc", borderRadius: 8 }}
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
              cornerRadius={6}
              draggable={mode === "builder"}
              onClick={() => onSectionClick?.(section.id)}
              onDragEnd={(e) =>
                onElementDragEnd?.(
                  "section",
                  section.id,
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
              fill="#475569"
              listening={false}
            />
          </Group>
        ))}

        {data.tables.map((table) => (
          <Group key={table.id}>
            {table.shape === TableShape.CIRCLE ? (
              <Circle
                x={table.x}
                y={table.y}
                radius={28}
                fill={builderColors.table.fill}
                stroke={builderColors.table.stroke}
                strokeWidth={1.5}
                draggable={mode === "builder"}
                onClick={() => onTableClick?.(table.id)}
                onDragEnd={(e) =>
                  onElementDragEnd?.(
                    "table",
                    table.id,
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
                fill={builderColors.table.fill}
                stroke={builderColors.table.stroke}
                strokeWidth={1.5}
                cornerRadius={4}
                draggable={mode === "builder"}
                onClick={() => onTableClick?.(table.id)}
                onDragEnd={(e) =>
                  onElementDragEnd?.(
                    "table",
                    table.id,
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
              fill="#1e293b"
              listening={false}
            />

            {table.seats.map((seat) => {
              const status = seatStatuses?.[seat.id] ?? SeatStatus.AVAILABLE;
              const colors =
                mode === "picker"
                  ? seatStatusColors[status]
                  : builderColors.seat;
              const clickable =
                mode === "builder" ||
                (mode === "picker" &&
                  (status === SeatStatus.AVAILABLE ||
                    status === SeatStatus.HELD_BY_ME));

              return (
                <Group key={seat.id}>
                  <Circle
                    x={seat.x}
                    y={seat.y}
                    radius={SEAT_RADIUS}
                    fill={colors.fill}
                    stroke={colors.stroke}
                    strokeWidth={1.5}
                    draggable={mode === "builder"}
                    onClick={() => clickable && onSeatClick?.(seat.id)}
                    onTap={() => clickable && onSeatClick?.(seat.id)}
                    onDragEnd={(e) =>
                      onElementDragEnd?.(
                        "seat",
                        seat.id,
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
                    fill="#1e293b"
                    listening={false}
                  />
                </Group>
              );
            })}
          </Group>
        ))}
      </Layer>
    </Stage>
  );
}
