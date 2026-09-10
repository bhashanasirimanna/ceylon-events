/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("@ceylon/design-system/tailwind.preset.js")],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../libs/design-system/src/**/*.{ts,tsx}",
  ],
};
