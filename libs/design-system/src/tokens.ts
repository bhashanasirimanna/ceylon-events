// "Event poster" design language: dark, editorial, single-accent.
// One brand accent (red) carries all emphasis/interaction; amber and
// emerald are semantic secondaries, never decorative — amber always
// means "perk/reward/promo", emerald always means "trust/validity".
export const colors = {
  brand: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
  },
  // Perks/rewards/promo — offers, promo codes. Never used decoratively.
  perk: {
    100: "#fef3c7",
    300: "#fcd34d",
    500: "#f59e0b",
    700: "#b45309",
  },
  // Trust/validity — a scanned ticket that's genuinely valid. Never
  // used decoratively.
  trust: {
    100: "#d1fae5",
    300: "#6ee7b7",
    500: "#10b981",
    700: "#047857",
  },
  // 4-step elevation ladder. Adjacent <section>s alternate base/alt;
  // raised is for cards/modals; footer is footer-only.
  surface: {
    base: "#0A0A0B",
    alt: "#0C0C0E",
    raised: "#141416",
    footer: "#1C1C1C",
  },
  white: "#ffffff",
} as const;

/** Curated swatches for ColorPicker — every one is a real token above,
 * never an arbitrary hex, so anything picked always renders on-brand. */
export const paletteSwatches = [
  colors.brand[600],
  colors.brand[400],
  colors.perk[500],
  colors.perk[300],
  colors.trust[500],
  colors.trust[300],
  "#a1a1aa", // zinc-400 — the neutral option
  "#ffffff",
] as const;

export const radii = {
  none: "0px",
  full: "9999px",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
} as const;
