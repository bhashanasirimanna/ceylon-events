import confetti from "canvas-confetti";
import { colors } from "./tokens";

const PALETTE = [colors.brand[500], colors.perk[500], colors.trust[500], colors.white];

/**
 * Fires a short confetti burst in this system's own palette — call this
 * only on a real success event (booking confirmed, ticket checked in),
 * never as decoration. Respects prefers-reduced-motion: does nothing if
 * the caller passes reducedMotion: true (get it from
 * usePrefersReducedMotion() and thread it through).
 */
export function fireConfetti(options: { reducedMotion?: boolean } = {}): void {
  if (options.reducedMotion) return;
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: PALETTE,
    disableForReducedMotion: true,
  });
}
