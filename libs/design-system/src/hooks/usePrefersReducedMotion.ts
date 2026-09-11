"use client";

import { useEffect, useState } from "react";

/**
 * Every animated component in this system reads this before running any
 * Framer Motion transition or CSS animation, falling back to an instant/
 * no-motion state. Never skip wiring a new animated component to this —
 * it's the one hard rule this system does not compromise on.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(query.matches);
    const handler = (event: MediaQueryListEvent) =>
      setPrefersReduced(event.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}
