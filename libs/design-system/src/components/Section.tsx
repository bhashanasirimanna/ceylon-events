import type { HTMLAttributes, ReactNode } from "react";

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  tone?: "base" | "alt";
  children: ReactNode;
}

/**
 * The one page-section primitive every page in every app composes,
 * instead of copy-pasting the max-width/gutter/hairline markup. Adjacent
 * sections should alternate tone="base"/"alt" so the page reads as
 * distinct bands rather than one flat scroll.
 */
export function Section({ tone = "base", className = "", children, ...props }: SectionProps) {
  return (
    <section
      className={`border-t border-zinc-900 py-24 ${tone === "alt" ? "bg-surface-alt" : "bg-surface-base"} ${className}`}
      {...props}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

export interface SectionHeaderProps {
  eyebrow?: string;
  icon?: ReactNode;
  /** The neutral-colored half of the two-tone headline. */
  title: string;
  /** The brand-accent-colored half — this system's signature device: one
   * word neutral, one word accent (e.g. title="UPCOMING" accent="EVENTS"). */
  accent: string;
  subhead?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  eyebrow,
  icon,
  title,
  accent,
  subhead,
  align = "left",
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`mb-12 ${align === "center" ? "text-center" : ""} ${className}`}>
      {eyebrow && (
        <p className="mb-3 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-brand-500">
          {icon}
          {eyebrow}
        </p>
      )}
      <h2 className="text-4xl font-black uppercase leading-[0.95] tracking-tightest text-white sm:text-5xl lg:text-6xl">
        {title} <span className="text-brand-500">{accent}</span>
      </h2>
      {subhead && (
        <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-zinc-400">
          {subhead}
        </p>
      )}
    </div>
  );
}
