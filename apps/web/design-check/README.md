# Figma design check

"Pixel-perfect" as a number, not an opinion. For every spec in `specs/*.json` the runner opens the
route at the Figma frame size (1728×1000 for the desktop frames), finds each element tagged
`data-figma="<key>"`, and compares its box `[x, y, w, h]` (±2px) and selected computed styles with
the Figma geometry. It also saves a screenshot, a pixel diff and a 50/50 overlay against the Figma
export in `reference/figma/` so a human can see what the numbers mean.

```bash
npm run dev                                  # the app on :3000 (guest mode is enough)
npm run design:check                         # all specs
npm run design:check -- builder-step1        # one spec
BASE_URL=http://localhost:3001 npm run design:check
```

Output: `design-check/out/REPORT.md` (table per screen), `results.json`, `<id>.png`,
`<id>-diff.png`, `<id>-overlay.png`. Exit code 1 when a spec marked `"locked": true` has a failing
or missing check — that is the CI gate (`.github/workflows/design-check.yml`).

## What is checked, what is not

| Checked (gate) | Not checked |
|---|---|
| position and size of every tagged element, ±2px at the Figma frame size | text widths (they depend on the font the OS has) |
| font size / weight / line height / letter spacing / colours / radii where the spec lists them | emoji artwork (Apple vs Noto vs Segoe) |
| | the pixel-diff % — informational only |

Fonts: the Figma file uses SF Pro Display (titles, badge), Helvetica (menu, buttons) and Inter
(everything in cards). SF Pro can't be shipped (Apple licence), so `--font-display` is the system
stack — SF on Apple devices, Segoe UI / Roboto elsewhere. Inter is self-hosted from
`public/fonts/inter` (OFL), so it renders identically on every OS.

## Adding a screen

1. Tag the elements: `data-figma="<key>"` (see `components/app/AppShell.tsx`, `ProgressBar.tsx`).
2. Snapshot the Figma geometry (Figma MCP `get_metadata` on the page, then
   `python3 figma/xml_to_json.py <metadata.xml|tool-result.json> > figma/page-<id>.json`).
   Figma instances are leaves in that output, so boxes inside an instance go into the spec by hand
   (`"box": [x, y, w, h]`, `null` = don't check that dimension).
3. Write `specs/<id>.json`: `frame`, `route`, `viewport`, optional `setup` steps
   (`{ "click": "<selector>" }`, `{ "fill": ["<selector>", "text"] }`, `{ "wait": ms }`),
   `reference` (the Figma export PNG) and `checks`.
4. Iterate until it passes, then set `"locked": true`.

## Icons

`components/figma-icons.tsx` is generated from the exact Iconify icons the Figma layers name
(`icons/manifest.json` → `icons/generate.mjs`; sources and licences in `ICON-SOURCES.md`, which
also lists the CC BY icons that need credit). Don't hand-edit the generated file.

## Known, deliberate deviations from Figma

- **Title / badge font** off Apple devices (system font instead of SF Pro).
- **Emoji** are the platform's own.
- **Sidebar extras**: "My Resumes (n)" appears once there is a CV (Figma's variant with a count);
  "Tracker" only for signed-in users; a small "Feedback" link in the sidebar's empty bottom strip.
  A guest's first visit shows exactly the Figma sidebar.
- **Below 1728px** Figma has no frames: the content column shrinks (max 1135px), the gutter
  tightens under 1280px, the sidebar becomes a drawer under 1024px, phones get a compact stepper.
  The phone/tablet look is derived and awaits design approval.
