"use client";
// Accent color picker — lets the client choose the template's accent. Six presets here,
// but the store's `accent` and `resolveTheme` both accept any hex string, so you can swap
// this for a full <input type="color"> picker if you want unlimited colors.
import { TOKENS } from "@/components/cv/templates/theme";
import { useBuilderStore } from "@/stores/cv-builder-store";

const NAMES = ["Violet", "Teal", "Blue", "Green", "Rose", "Amber"];

export function AccentPicker() {
  const accent = useBuilderStore((s) => s.accent);
  const setAccent = useBuilderStore((s) => s.setAccent);

  return (
    <div className="flex items-center gap-2">
      {TOKENS.primaries.map((color, i) => {
        const value = i + 1;
        const selected = accent === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setAccent(value)}
            aria-label={NAMES[i]}
            title={NAMES[i]}
            className={`h-7 w-7 rounded-full border-2 transition ${selected ? "scale-110 border-zinc-900" : "border-transparent"}`}
            style={{ backgroundColor: color }}
          />
        );
      })}

      {/* Optional: unlimited colors — resolveTheme accepts any hex.
      <input type="color" onChange={(e) => setAccent(e.target.value)}
        className="h-7 w-7 cursor-pointer rounded-full border border-zinc-200" /> */}
    </div>
  );
}
