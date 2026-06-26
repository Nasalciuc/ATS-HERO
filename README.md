# ATS Hero

ATS Hero helps job seekers build ATS-friendly CVs, score them against applicant tracking systems, and match them to job descriptions. The UI is aligned with the Figma **User flow (Desktop)** designs.

Production code lives in **`apps/web`** (Next.js 16), **`apps/ai`** (Python FastAPI), and **`packages/shared`**.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture spec.

## Stack

| Layer | Technology | Location |
| --- | --- | --- |
| Web app | Next.js 16.2 + React 19.2 | `apps/web/` |
| Styling | Global CSS tokens + Tailwind (preflight off) | `apps/web/app/styles.css` |
| PDF | `@react-pdf/renderer` + `pdfjs-dist` | Client-side |
| Local state | Zustand + `localStorage` (guest CV flow) | `apps/web/stores/` |
| Backend | Convex (document DB, auth, actions) | `apps/web/convex/` |
| Auth | Clerk | `apps/web/` |
| AI / NLP | FastAPI + spaCy | `apps/ai/` |
| Shared data | Detector JSON, types | `packages/shared/` |
| Testing | Vitest (scoring/jobfit), Playwright (visual audit) | `apps/web/`, `tools/scripts/` |

## Monorepo layout

```
apps/
  web/          Next.js 16 production frontend
  ai/           Python FastAPI module (Tier 2–3 NLP + LLM)
packages/
  shared/       Shared JSON data and constants
tools/
  scripts/      Figma download, Playwright audit
  postman/      Legacy Express API collection (archived reference)
reference/figma/  Design reference exports
tests/          Screenshot audit outputs
```

## Getting started

### Web app (Next.js)

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
npm run build
npm run start
```

Or from the repo root:

```bash
npm run dev:web
npm run build:web
```

### Convex (interactive — required for cloud builds)

```bash
cd apps/web
npx convex dev     # generates convex/_generated/ + NEXT_PUBLIC_CONVEX_URL
```

Set Clerk keys in `apps/web/.env.local` and `CLERK_JWT_ISSUER_DOMAIN` in the Convex dashboard. See `CLAUDE.md`.

### Python AI service

```bash
cd apps/ai
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Routes

| Route | Screen |
| --- | --- |
| `/` | Landing page |
| `/app/create` | CV builder wizard |
| `/app/improve` | Improve CV (paste/upload → ATS analysis) |
| `/app/jobfit` | Job Fit (CV + job description → match score) |
| `/app/score` | ATS score results (gauge + per-section breakdown) |

## Feature tiers

| Tier | What | Where |
| --- | --- | --- |
| 0 | CV builder + watermarked PDF export | Client |
| 1 | PDF text extraction + basic ATS score | `apps/web/lib/analyzer/` |
| 2 | DOCX + spaCy NLP + full recommendations | `apps/ai/` |
| 3 | AI deep analysis, rewrite, job fit AI | `apps/ai/` + LLM |

## Testing

```bash
# Unit tests — scoring engine + job fit (Vitest)
cd apps/web && npm test

# Visual audit — Playwright screenshots (Next.js on :3000)
npm run audit:screenshots
```

## Vercel deployment

Set **Root Directory** to `apps/web` in the Vercel project settings. `apps/web/vercel.json` pins the Next.js framework.

## ATS scoring engine

Each CV section is scored 0–100 on completeness, content quality, measurable results, keyword richness, and formatting.

| Location | Role |
| --- | --- |
| `apps/web/lib/analyzer/ats-scorer.ts` | Tier 1 client-side scoring |
| `apps/web/lib/analyzer/keyword-matcher.ts` | Tier 1 job-fit matching |
| `apps/ai/app/analyzers/` | Tier 2 spaCy NLP |

## Design tokens

| Token | Value |
| --- | --- |
| Page background | `#F5F3FF` |
| Dark sections | `#2E2E2E` |
| Features background | `#D6F7E2` |
| Green accent | `#00C450` / ring `#00DE81` |
| Violet | `#B2A5FF` / `#D9D2FF` / `#725BFE` |
| Error red | `#FF6161` |
| Fonts | Helvetica (headings/body), Inter (badges & feature titles) |

## License

Private — see repository owner for usage terms.
