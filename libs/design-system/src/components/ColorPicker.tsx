"use client";

import { colors, paletteSwatches } from "../tokens";

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  /** Defaults to this system's own curated palette — every swatch is a
   * real token, never an arbitrary hex, so anything picked stays on-brand. */
  swatches?: readonly string[];
  className?: string;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function ColorPicker({
  value,
  onChange,
  swatches = paletteSwatches,
  className = "",
}: ColorPickerProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {swatches.map((swatch) => (
        <button
          key={swatch}
          type="button"
          onClick={() => onChange(swatch)}
          aria-label={`Choose color ${swatch}`}
          aria-pressed={value.toLowerCase() === swatch.toLowerCase()}
          style={{ backgroundColor: swatch }}
          // True circles are this system's one exception to sharp
          // corners — icon-toggle controls, which these swatches are.
          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
            value.toLowerCase() === swatch.toLowerCase()
              ? "border-white"
              : "border-transparent"
          }`}
        />
      ))}
      <input
        type="color"
        value={HEX_PATTERN.test(value) ? value : colors.white}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Custom color"
        className="h-7 w-7 cursor-pointer rounded-none border border-zinc-700 bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#hex"
        aria-label="Hex color value"
        className="w-24 rounded-none border border-zinc-700 bg-surface-raised px-2 py-1 font-mono text-xs text-zinc-200"
      />
    </div>
  );
}
