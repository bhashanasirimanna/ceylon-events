import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand" | "accent";

// Badges are this system's "eyebrow/metadata" register — always mono,
// bold, tracked out. success maps to the trust/emerald secondary
// (valid ticket, confirmed), warning to the perk/amber secondary
// (offer, promo), matching their meaning everywhere else in the app.
const toneClasses: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-300",
  success: "bg-trust-500/15 text-trust-300",
  warning: "bg-perk-500/15 text-perk-300",
  danger: "bg-brand-600/15 text-brand-400",
  brand: "bg-brand-600/15 text-brand-400",
  // A just-completed action (offer redeemed, ticket validated) pops in
  // rather than just appearing.
  accent: "bg-trust-500/15 text-trust-300 animate-pop-in",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-none px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-widest ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
