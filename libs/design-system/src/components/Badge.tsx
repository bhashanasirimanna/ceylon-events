import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  brand: "bg-brand-100 text-brand-700",
  // A small "success glow" — e.g. a just-confirmed ticket or a
  // just-redeemed offer — pops in rather than just appearing.
  accent: "bg-accent-100 text-accent-700 animate-pop-in",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
