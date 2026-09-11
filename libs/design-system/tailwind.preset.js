/** Shared Tailwind preset for all Ceylon Events portals. */
module.exports = {
  theme: {
    extend: {
      colors: {
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
        night: {
          700: "#241b3a",
          800: "#1a1230",
          900: "#120c22",
        },
      },
      backgroundImage: {
        "party-gradient": "linear-gradient(135deg, #7c3aed 0%, #ec4899 60%, #f97316 100%)",
        "party-gradient-soft": "linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%)",
        "night-gradient": "linear-gradient(160deg, #120c22 0%, #241b3a 100%)",
      },
      borderRadius: {
        pill: "9999px",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(236,72,153,0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(236,72,153,0)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "confetti-fall": {
          "0%": { transform: "translateY(-8px) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(64px) rotate(360deg)", opacity: "0" },
        },
      },
      animation: {
        glow: "glow-pulse 1.8s ease-in-out infinite",
        "pop-in": "pop-in 0.2s ease-out",
        "confetti-fall": "confetti-fall 900ms ease-in forwards",
      },
    },
  },
};
