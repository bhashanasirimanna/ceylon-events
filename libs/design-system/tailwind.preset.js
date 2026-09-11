/** Shared Tailwind preset for all Ceylon Events portals — the "event
 * poster" design language: dark, editorial, single-accent. Every entry
 * here is wired into at least one component; don't add to this file
 * without using it. */
module.exports = {
  theme: {
    extend: {
      colors: {
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
        perk: {
          100: "#fef3c7",
          300: "#fcd34d",
          500: "#f59e0b",
          700: "#b45309",
        },
        trust: {
          100: "#d1fae5",
          300: "#6ee7b7",
          500: "#10b981",
          700: "#047857",
        },
        surface: {
          base: "#0A0A0B",
          alt: "#0C0C0E",
          raised: "#141416",
          footer: "#1C1C1C",
        },
      },
      letterSpacing: {
        tightest: "-0.075em",
      },
      borderRadius: {
        none: "0px",
      },
      boxShadow: {
        "glow-accent": "0 0 0 1px rgba(239,68,68,0.4), 0 0 24px 0 rgba(239,68,68,0.35)",
        "glow-trust": "0 0 0 1px rgba(16,185,129,0.4), 0 0 24px 0 rgba(16,185,129,0.35)",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        glow: "glow-pulse 1.8s ease-in-out infinite",
        "pop-in": "pop-in 0.2s ease-out",
      },
    },
  },
};
