export const colors = {
  brand: {
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
  },
  accent: {
    50: "#fdf2f8",
    100: "#fce7f3",
    200: "#fbcfe8",
    300: "#f9a8d4",
    400: "#f472b6",
    500: "#ec4899",
    600: "#db2777",
    700: "#be185d",
    800: "#9d174d",
    900: "#831843",
  },
  neutral: {
    0: "#ffffff",
    50: "#f8fafc",
    100: "#f1f5f9",
    300: "#cbd5e1",
    500: "#64748b",
    700: "#334155",
    900: "#0f172a",
    950: "#0b0716",
  },
  night: {
    700: "#241b3a",
    800: "#1a1230",
    900: "#120c22",
  },
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
} as const;

/** Curated swatches for ColorPicker — drawn from the palette above so
 * anything picked there always renders on-brand. */
export const paletteSwatches = [
  colors.brand[600],
  colors.brand[400],
  colors.accent[600],
  colors.accent[400],
  "#f97316", // warm amber, the gradient's third stop
  colors.success,
  colors.warning,
  colors.danger,
  colors.neutral[500],
  colors.neutral[900],
] as const;

export const gradients = {
  party: `linear-gradient(135deg, ${colors.brand[600]} 0%, ${colors.accent[500]} 60%, #f97316 100%)`,
  partySoft: `linear-gradient(135deg, ${colors.brand[50]} 0%, ${colors.accent[50]} 100%)`,
  night: `linear-gradient(160deg, ${colors.night[900]} 0%, ${colors.night[700]} 100%)`,
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "16px",
  pill: "9999px",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
} as const;
