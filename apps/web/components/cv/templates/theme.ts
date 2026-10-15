// Design tokens. `primary` is the one saturated accent (heading text, rules, bullets,
// sidebar). Recruiter-safe palette inspired by Reactive Resume's template colors.
export { FONT, FONT_BOLD } from "./fonts";

/** A4 width in points. */
export const A4_WIDTH = 595.28;

/** Page geometry of each template (pt). The templates' StyleSheets use these numbers, and
 *  `column` below is derived from them, so the two cannot drift apart. */
export const LAYOUT = {
  classic: { padX: 44, padY: 38 },
  minimal: { padX: 54, padY: 46 },
  modern: { padY: 30, sidebarPct: 34, sidebarPadX: 18, mainPadX: 24 },
} as const;

export interface TemplateTheme {
  primary: string;   // saturated accent
  text: string;      // strong text
  muted: string;     // roles, contact
  faint: string;     // dates, meta
  onPrimary: string; // text on a filled primary surface (modern sidebar)
  /** Entry meta placement. "split" = title left / dates right (current design). "stacked" =
   *  dates on the line under the title — every extractor keeps them with their entry (ATS lab). */
  meta?: "split" | "stacked";
  /** Width (pt) of the main text column — what a long word must fit into. */
  column: number;
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
  classic: { ...base, primary: "#725BFE", column: A4_WIDTH - 2 * LAYOUT.classic.padX },
  modern: { ...base, primary: "#725BFE", column: (A4_WIDTH * (100 - LAYOUT.modern.sidebarPct)) / 100 - 2 * LAYOUT.modern.mainPadX },
  minimal: { ...base, primary: "#3F3F46", column: A4_WIDTH - 2 * LAYOUT.minimal.padX },
};

/** Resolve a theme by template id, with an optional accent override (1-6 or hex). */
export function resolveTheme(templateId: string, accent?: number | string): TemplateTheme {
  const theme = THEMES[templateId] ?? THEMES.classic;
  if (accent == null) return theme;
  const primary = typeof accent === "number" ? TOKENS.primaries[(accent - 1) % TOKENS.primaries.length] : accent;
  return { ...theme, primary };
}
