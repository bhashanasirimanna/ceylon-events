import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "party";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-500",
  secondary:
    "bg-transparent text-zinc-200 border border-zinc-700 hover:border-brand-500 hover:text-white",
  danger: "bg-red-900 text-red-100 hover:bg-red-800",
  ghost: "bg-transparent text-brand-500 hover:text-brand-400",
  // The highest-stakes CTA on a page (buy tickets, place order) — same
  // brand red, just with the glow that this system reserves for
  // emphasis/selection, never used decoratively elsewhere.
  party: "bg-brand-600 text-white shadow-glow-accent hover:bg-brand-500",
};

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-none px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
