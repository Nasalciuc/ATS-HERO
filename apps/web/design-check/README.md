# Figma design check

"Pixel-perfect" as a number, not an opinion. For every spec in `specs/*.json` the runner opens the
route at the Figma frame size (1728×1000 for the desktop frames, 390 wide for the phone ones), finds each element tagged
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
| font size / weight / line height / letter spacing / colours / radii where the spec lists them | colours, text and styles a spec doesn't list |
| each tagged element is visible, on top at its centre (not covered) and the only one with its key | icon artwork — compare the screenshot with the Figma export |
| no uncaught error on the page (console errors are listed in the report, not gated) | emoji artwork (Apple vs Noto vs Segoe) |
| | the pixel-diff % — informational only |

Fonts: the Figma file uses SF Pro Display (titles, badge), Helvetica (menu, buttons) and Inter
(everything in cards). SF Pro can't be shipped (Apple licence), so `--font-display` is the system
stack — SF on Apple devices, Segoe UI / Roboto elsewhere. Inter is self-hosted from
`public/fonts/inter` (OFL), so it renders identically on every OS.

## Adding a screen

1. Tag the elements: `data-figma="<key>"` (see `components/app/AppShell.tsx`, `ProgressBar.tsx`).
2. Snapshot the Figma geometry (Figma MCP `get_metadata` on the page, then
   `python3 figma/xml_to_json.py <metadata.xml|tool-result.json> > figma/page-<id>.json`).
   `page-180-17.json` is the desktop page, `page-17-1152.json` the mobile one. Figma instances are
   leaves in that output, so boxes inside an instance go into the spec by hand
   (`"box": [x, y, w, h]`, `null` = don't check that dimension). Groups are resolved in their
   parent's coordinates (the converter tells a group from a frame by its children's bounds).
3. Write `specs/<id>.json`: `frame`, `route`, `viewport` (`"touch": true` emulates a phone,
   `"reducedMotion": true` stops spinners that have a reduced-motion fallback), optional `setup`
   steps (`{ "click": "<selector>" }`, `{ "fill": ["<selector>", "text"] }`,
   `{ "press": ["<selector>", "Enter"] }`, `{ "select": ["<selector>", "value"] }`, `{ "wait": ms }`,
   `{ "goto": "/path" }`, `{ "session": { "key": value } }` — sessionStorage for the next page, an
   object stored as JSON and `{ "$file": "fixtures/<name>.json" }` as that file's JSON —, and
   `{ "clock": "pause" }`, which freezes the page's timers to hold a loading screen), `reference`
   (the Figma export PNG) and `checks`. A check with
   `"relativeTo": "<key>"` compares its x/y as an offset from that element (for content inside a
   centred pop-up whose height differs from Figma's); `"hit": false` skips the "on top" test where a
   transparent control deliberately covers the element (the phone Pro Tips card).
4. Iterate until it passes, then set `"locked": true`.

## Icons

`components/figma-icons.tsx` is generated from the exact Iconify icons the Figma layers name
(`icons/manifest.json` → `icons/generate.mjs`; sources and licences in `ICON-SOURCES.md`, which
also lists the CC BY icons that need credit). Don't hand-edit the generated file.

Where Figma flattened an icon or named the wrong one, the closest Iconify glyph was picked by shape
(the manifest says which). Approximations, with the stroke matched to the Figma export by counting
ink pixels (`styles.css`):

- chip × (`iconamoon:close`): stroke 1.33px — the 24px icon drawn at 16px, as in Figma;
- soft-skill person (`fluent:person-24-regular`): outline thickened by a 1.35 stroke — Figma's is heavier;
- ATS-score gauge (`streamline-plump:dashboard-gauge-2`): Figma's icon is custom;
- score badges (`mingcute:alert-line`): Figma flattened them; the same triangle for all three.

A manifest entry can drop shapes Figma hides: `"omit": [5]` removes the icon's sixth shape (the
ATS Score loading icon is `pepicons-pencil:cv-circle` without its circle).

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
| `builder-certifications` | 293:891 Step 8 | same, Next to Certifications |
| `builder-publications` | 293:1094 Step 9 | same, last step |
| `popup-tips` | 336:6042 Pop-up_Tips | Explore on Personal info |
| `popup-add-section` | 331:4891 Pop-up_Add section (v2: subtitle + Continue) | "+ Add section" in the stepper |
| `popup-almost-there` | 358:7402 | Awards added and left empty, then Complete |
| `popup-complete` | 311:3326 Pop-up_Complete | Preview on Personal info |
| `phone-work` | 77:190 (mobile) Work experience | 390px; Relevant activities added, Next to Work |
| `phone-skills` | 83:536 (mobile) Skills | 390px; Certifications added, the Figma chips typed in |
| `phone-education-card` | 77:15 (mobile) Education with a saved entry | 390px; two entries, the first as a card |
| `phone-awards` | 86:1618 (mobile) Awards | 390px; Awards added |
| `phone-hub` | 55:322 (mobile) home | 390px; one CV saved, then /app |
| `analyze-improve` | 230:685 Function 2 · Improve CV | /app/improve |
| `analyze-jobfit` | 398:8400 Function 3 · Check Job Fit | /app/jobfit |
| `score-loading` | 319:3807 ATS Score Estimation (loading) | builder flow; timers paused |
| `score-loading-improve` | 331:5590 loading with the progress bar | Improve flow; timers paused |
| `score-results` | 319:4126 ATS Score_Results | `fixtures/score-report.json` (the Figma numbers) |
| `score-results-improve` | 383:8025 results with the progress bar | same report, Improve flow |
| `score-fix` | 383:7664 results, Fix now open | same report, Fix now on the first section |
| `landing` | 180:19 the landing page (1728×4549) | `/`, first FAQ open |
| `not-found` | 331:4830 Error (404); geometry in `figma/frame-331-4830.json` | any unknown route |

## Known, deliberate deviations from Figma

- **Title / badge font** off Apple devices (system font instead of SF Pro).
- **Emoji** are the platform's own.
- **Sidebar extras**: "My Resumes (n)" appears once there is a CV (Figma's variant with a count);
  "Tracker" only for signed-in users; a small "Feedback" link, always shown, in the sidebar's empty
  bottom strip (the one addition on a guest's first visit).
- **Builder copy/flow where the Figma file contradicts itself**: placeholders on Awards/Certifications
  /Publications are real examples (Figma reuses "David Smith"/"davidsmith@gmail.com" from step 1);
  the Publications badge says "Publications" (Figma: "Certifications"); "Next step" is hidden on the
  last step (the Skills frame hides it, the Publications frame doesn't); the "Add one more …" icon gap
  is 4px everywhere (one frame uses 8px).
- **Volunteering** has no desktop frame (only the mobile wireframe has one); it reuses the
  "Relevant activities" layout.
- **Pop-ups** are centred (two Figma frames sit 49px right / 36px up of centre; the third is
  centred). "Add section" lists every section not added yet — 5 on a fresh CV, Figma shows 3 — and
  its "Continue" just closes when nothing is ticked (Figma shows it always enabled). The overlay is
  Figma's solid #2e2e2e (`--modal-overlay`), not see-through.
- **Complete pop-up**: Figma lists "Style 1–6"; we list our three templates by name and keep the
  accent colours under them. The preview is the real PDF drawn page by page (Figma shows a sample
  CV); the ATS-score icon is the closest Iconify glyph to Figma's custom one. "Download DOC" saves
  a Word .docx. With `NEXT_PUBLIC_ATS_CHECK_ENABLED=true` an "ATS read check" card (not in Figma)
  appears under the colours; CI doesn't set it, so a local screenshot can differ from CI's.
- **Phones (≤720px)** follow the mobile page (17:1152, marked in progress): an earlier wireframe in
  the old style (ATS-Inspector, blue buttons, "TITLE / Text" placeholders). We take its structure and
  geometry — "‹ Back · Create CV" bar, title, 62px stepper with the current step centred, the 105px
  tips card, 51px fields 10 apart, saved entries as cards, full-width buttons at the end, the home
  screen — in the desktop style and the desktop step order (approved 13 Oct 2026). Where the
  wireframe frames disagree with each other (the tips card at 256/271/275, the gap under it 24 or
  30), the majority wins and the specs say which frame they follow. Preview and Save stay in the
  bar as icons; the photo upload, Language + Level and the Activities suggestion are desktop
  features the wireframe doesn't have.
- **Tablets (721–1023px)**: the desktop layout with the drawer, a wide Pro Tips banner and the
  two-column form; between 1024 and 1728 the content column shrinks (max 1135px) and the gutter
  tightens under 1280px. When the steps don't fit, the clipped side fades out and mice get a thin
  scrollbar; "Add section" scrolls with the steps.
- **Improve / Job Fit**: the fields' placeholders say what to paste (Figma repeats "Graduated with
  honors, final grade 1.3" from the builder).
- **ATS Score**: one colour rule for every score — green from 80, amber from 50, red below (Figma's
  sample rows disagree: the same 80/100 is amber in one row and green in others, and one amber ring
  is #f90 instead of #ffc107). The general score's arc is the score's share of the circle (Figma
  draws ~58% for 61.3). "Fix now" centres its text (Figma keeps room for an empty icon slot, 4px
  off-centre). The Fix-now form is the builder's step form; Figma also outlines the fields behind
  each issue red/orange, which needs the scorer to name the field (it doesn't yet). The loading
  ring turns (it stands still under reduced motion, as drawn in Figma). The Job Fit result (match %, matched and
  missing keywords) has no Figma frame: it reuses the score circle and the badges. Phones have no
  Figma frame either: the builder's phone style.
- **Landing**: Figma's footer frame sits 10px right of the page grid (and its trophy overhangs the
  grid by 33px); we keep the grid, so the spec's footer boxes are Figma's minus 10. The FAQ list is
  2px left of the grid in Figma (within tolerance). Terms / Privacy links (not in Figma) sit in the
  footer's bottom padding. Wrapping can differ by a word where the font isn't Helvetica
  ("PDF/" in "Personalized approach"). The feature icons are flattened in Figma: the closest
  Iconify glyphs at Figma's glyph size (the steps match; gauge and user are stand-ins).
- **Contrast**: some Figma colours fail WCAG AA (placeholder #ccc, 12px grey labels, the 12px green
  step label, Pro Tips body, badge, page count). They are kept as designed pending a design decision.
