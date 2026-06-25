// Design tokens. `primary` is the one saturated accent (heading text, rules, bullets,
// sidebar). Recruiter-safe palette inspired by Reactive Resume's template colors.
export { FONT, FONT_BOLD } from "./fonts";

export interface TemplateTheme {
  primary: string;   // saturated accent
  text: string;      // strong text
  muted: string;     // roles, contact
  faint: string;     // dates, meta
  onPrimary: string; // text on a filled primary surface (modern sidebar)
}

export const TOKENS = {
  text: "#2E2E2E",
  muted: "#52525B",
  faint: "#6B7280",
  white: "#FFFFFF",
  // Saturated, ATS-safe accent options (violet is the ATS Hero brand).
  primaries: ["#725BFE", "#0EA5A4", "#2563EB", "#00A862", "#E5484D", "#B7791F"],
} as const;

const base = { text: TOKENS.text, muted: TOKENS.muted, faint: TOKENS.faint, onPrimary: TOKENS.white };

export const THEMES: Record<string, TemplateTheme> = {
  classic: { ...base, primary: "#725BFE" },
  modern: { ...base, primary: "#725BFE" },
  minimal: { ...base, primary: "#3F3F46" },
};

/** Resolve a theme by template id, with an optional accent override (1-6 or hex). */
export function resolveTheme(templateId: string, accent?: number | string): TemplateTheme {
  const theme = THEMES[templateId] ?? THEMES.classic;
  if (accent == null) return theme;
  const primary = typeof accent === "number" ? TOKENS.primaries[(accent - 1) % TOKENS.primaries.length] : accent;
  return { ...theme, primary };
}
