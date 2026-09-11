import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Border-colorizes to the brand accent with a glow — this system's
   * one emphasis mechanic, reused for "just confirmed" success states,
   * a featured event, or a selected seat/tier. */
  glow?: boolean;
}

export function Card({ className = "", glow = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-none border border-zinc-800 bg-surface-raised p-4 transition-colors duration-150 ${glow ? "border-brand-500 shadow-glow-accent" : ""} ${className}`}
      {...props}
    />
  );
}
