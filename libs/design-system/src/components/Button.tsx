import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "party";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  secondary: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "bg-transparent text-brand-600 hover:bg-brand-50",
  // For hero/CTA surfaces — "buy tickets", "place order" — where the
  // extra visual weight of a gradient + glow earns its place.
  party:
    "bg-party-gradient text-white shadow-sm hover:shadow-lg hover:shadow-accent-500/25",
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
      className={`inline-flex items-center justify-center rounded-pill px-4 py-2 text-sm font-medium transition-all duration-150 hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
