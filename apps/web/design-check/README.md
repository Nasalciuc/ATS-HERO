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

## Screens covered

| Spec | Figma frame | State the setup builds |
|---|---|---|
| `builder-step1` | 242:950 Step 1 · Personal info | fresh guest |
| `builder-education` | 249:1655 Step 2 | Next ×1 |
| `builder-education-tabs` | 249:1850 Step 2 variant 2 | two education entries, first tab active |
| `builder-summary` | 272:77 Step 4 | Next ×2 |
| `builder-work` | 272:609 Step 5 | Next ×3 (Activities suggestion card visible) |
| `builder-skills` | 358:6909 Step 11 | Next ×4, the Figma chips typed in |
| `builder-activities` | 293:1309 Step 10 | Relevant activities added, reached with Next |
| `builder-awards` | 291:1321 Step 7 | four optional sections added |
| `builder-publications` | 293:1094 Step 9 | same, last step |
| `popup-tips` | 336:6042 Pop-up_Tips | Explore on Personal info |
| `popup-add-section` | 311:3740 / 331:4891 Pop-up_Add section | "+ Add section" in the stepper |
| `popup-almost-there` | 358:7402 | Awards added and left empty, then Complete |
| `popup-complete` | 311:3326 Pop-up_Complete | Preview on Personal info |

## Known, deliberate deviations from Figma

- **Title / badge font** off Apple devices (system font instead of SF Pro).
- **Emoji** are the platform's own.
- **Sidebar extras**: "My Resumes (n)" appears once there is a CV (Figma's variant with a count);
  "Tracker" only for signed-in users; a small "Feedback" link in the sidebar's empty bottom strip.
  A guest's first visit shows exactly the Figma sidebar.
- **Builder copy/flow where the Figma file contradicts itself**: placeholders on Awards/Certifications
  /Publications are real examples (Figma reuses "David Smith"/"davidsmith@gmail.com" from step 1);
  the Publications badge says "Publications" (Figma: "Certifications"); "Next step" is hidden on the
  last step (the Skills frame hides it, the Publications frame doesn't); the "Add one more …" icon gap
  is 4px everywhere (one frame uses 8px).
- **Volunteering** has no Figma frame; it reuses the "Relevant activities" layout.
- **Pop-ups** are centred (two Figma frames sit 49px right / 36px up of centre; the third is
  centred). "Add section" lists every section not added yet — 5 on a fresh CV, Figma shows 3 — and
  its "Continue" just closes when nothing is ticked (Figma shows it always enabled). The overlay is
  Figma's solid #2e2e2e (`--modal-overlay`), not see-through.
- **Complete pop-up**: Figma lists "Style 1–6"; we list our three templates by name and keep the
  accent colours under them. The preview is the real PDF drawn page by page (Figma shows a sample
  CV); the ATS-score icon is the closest Iconify glyph to Figma's custom one.
- **Below 1728px** Figma has no frames: the content column shrinks (max 1135px), the gutter
  tightens under 1280px, the sidebar becomes a drawer under 1024px, phones get a compact stepper.
  The phone/tablet look is derived and awaits design approval.
