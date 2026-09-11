import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** A pulsing accent glow for a just-completed success state (e.g. a
   * confirmed order, a redeemed offer) — draws the eye without a modal. */
  glow?: boolean;
}

export function Card({ className = "", glow = false, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-shadow duration-150 hover:shadow-md ${glow ? "animate-glow" : ""} ${className}`}
      {...props}
    />
  );
}
