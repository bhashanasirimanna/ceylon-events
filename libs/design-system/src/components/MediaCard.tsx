"use client";

import { motion } from "framer-motion";
import type { KeyboardEvent, ReactNode } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export interface MediaCardProps {
  imageUrl?: string | null;
  imageAlt?: string;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Rendered top-right over the image (a badge, a price, a countdown). */
  meta?: ReactNode;
  footer?: ReactNode;
  /** Always-on border glow — a genuinely featured item, not decoration. */
  featured?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * The one image+text card every feature composes — event cards, menu
 * item cards, restaurant cards, lineup cards. Implements the four-part
 * hover combo (lift, border colorize, image push-in, title colorize)
 * and the standard scrim once, here, instead of per-feature.
 */
export function MediaCard({
  imageUrl,
  imageAlt = "",
  eyebrow,
  title,
  subtitle,
  meta,
  footer,
  featured = false,
  onClick,
  className = "",
}: MediaCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }

  return (
    <motion.div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      whileHover={prefersReducedMotion || !onClick ? undefined : { y: -6 }}
      whileTap={prefersReducedMotion || !onClick ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={`group relative overflow-hidden border text-left transition-colors duration-300 ${
        onClick ? "cursor-pointer" : ""
      } ${
        featured
          ? "border-brand-500 shadow-glow-accent"
          : "border-zinc-800 hover:border-brand-500"
      } ${className}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
            className={`h-full w-full object-cover transition-transform duration-500 ${
              prefersReducedMotion ? "" : "group-hover:scale-110"
            }`}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-zinc-900 to-black" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-raised via-transparent to-black/60" />
        {meta && <div className="absolute right-3 top-3">{meta}</div>}
      </div>
      <div className="p-4">
        {eyebrow && (
          <p className="mb-1 font-mono text-xs font-bold uppercase tracking-widest text-brand-500">
            {eyebrow}
          </p>
        )}
        <h3 className="text-lg font-bold text-white transition-colors duration-300 group-hover:text-brand-400">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-sm font-medium text-zinc-400">{subtitle}</p>
        )}
        {footer && <div className="mt-3">{footer}</div>}
      </div>
    </motion.div>
  );
}
