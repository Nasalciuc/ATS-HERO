# ATS Hero

ATS Hero helps job seekers build ATS-friendly CVs, score them against applicant tracking systems, and match them to job descriptions. The UI is aligned with the Figma **User flow (Desktop)** designs.

This repo is a **monorepo in transition**: the production stack lives under `apps/` and `convex/`, while the original Vite + Express prototype remains at the repo root for reference and API testing during the rewrite.

## Stack

| Layer | Technology | Status |
| --- | --- | --- |
| Web app | **Next.js 16.2** (App Router, Turbopack) + **React 19.2** | ✅ Phase 1 — UI ported to `apps/web/` |
| Styling | Global CSS design tokens from Figma (`apps/web/app/styles.css`) | ✅ |
| PDF | `@react-pdf/renderer` + `pdfjs-dist` (export + upload parsing) | ✅ Client-side |
| Local state | Zustand + `localStorage` (guest CV flow) | ✅ |
| Backend | **Convex** (document DB, auth integration, actions) | 🚧 Scaffolding in `convex/` |
| Auth | **Clerk** | 🚧 Planned |
| AI / NLP | **FastAPI** + spaCy (`apps/ai/`) | 🚧 Scaffolding |
| Legacy API | Express + JWT + JSON file store (`server/`) | ✅ Prototype — Postman-tested |
| Legacy UI | Vite + React 18 (`src/`) | ✅ Prototype — kept during migration |
| Testing | Vitest (scoring/jobfit), Newman/Postman (API), Playwright (visual audit) | ✅ |
| CI | GitHub Actions (`.github/workflows/`) | 🚧 Placeholders |

See [`CLAUDE.md`](./CLAUDE.md) for the full production architecture spec.

## Monorepo layout

```
apps/
  web/          Next.js 16 production frontend (App Router)
  ai/           Python FastAPI module (Tier 2–3 NLP + LLM)
convex/         Convex schema, queries, mutations, actions
packages/
  shared/       Shared TypeScript types and constants
postman/        Postman collection + local environment
server/         Legacy Express API (port 8787)
src/            Legacy Vite SPA (port 5173)
reference/figma/  Design reference exports
scripts/        Figma download, Playwright audit, API smoke tests
tests/          Screenshot audit outputs
```

## Getting started

### Production web app (Next.js)

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
npm run build
npm run start
```

### Legacy prototype (Vite + Express)

Useful for comparing behaviour or running the Express API that Postman targets:

```bash
npm install          # repo root
npm run dev          # Vite :5173 + Express :8787
npm run web          # frontend only
npm run server       # API only
```

The Vite dev server proxies `/api` → `http://localhost:8787`.

## Routes

| Route | Screen |
| --- | --- |
| `/` | Landing page |
| `/app/create` | CV builder wizard |
| `/app/improve` | Improve CV (paste/upload → ATS analysis) |
| `/app/jobfit` | Job Fit (CV + job description → match score) |
| `/app/score` | ATS score results (gauge + per-section breakdown) |

These routes exist in both `apps/web/` (Next.js) and the legacy `src/` SPA.

## Feature tiers

| Tier | What | Where |
| --- | --- | --- |
| 0 | CV builder + watermarked PDF export | Client |
| 1 | PDF text extraction + basic ATS score | Client (`apps/web/lib/analyzer/`) |
| 2 | DOCX + spaCy NLP + full recommendations | `apps/ai/` (planned) |
| 3 | AI deep analysis, rewrite, job fit AI | `apps/ai/` + LLM (planned) |

## API (legacy Express)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Sign in (JWT) |
| `GET` | `/api/auth/me` | Current user |
| `GET/POST` | `/api/cv` | List / create CVs |
| `GET/PUT/DELETE` | `/api/cv/:id` | Read / update / delete |
| `POST` | `/api/score` | ATS score from `{ data }`, `{ cvId }`, or `{ text }` |
| `POST` | `/api/jobfit` | Match CV against a job description |

Guest CVs are stored in `localStorage` and claimed on sign-in. Server data lives in `server/data/db.json`.

## Testing

```bash
# Unit tests — scoring engine + job fit (Vitest)
npm test

# API — Postman collection via Newman (requires Express on :8787)
npm run server       # in one terminal
npm run postman:run  # in another

# Visual audit — Playwright screenshots (legacy Vite app)
npm run audit:screenshots
```

Import `postman/ATS-Hero-API.postman_collection.json` and `postman/ATS-Hero-Local.postman_environment.json` into Postman for manual runs.

## ATS scoring engine

Each CV section is scored 0–100 on completeness, content quality, measurable results, keyword richness, and formatting. Output includes **critical mistakes**, **suggestions**, and **good practices** per section.

| Location | Role |
| --- | --- |
| `server/scoring.ts` | Legacy Express implementation |
| `apps/web/lib/analyzer/ats-scorer.ts` | Tier 1 client-side (Next.js) |
| `apps/ai/app/analyzers/ats_scorer.py` | Tier 2 spaCy NLP (planned) |

Job-fit matching (`server/jobfit.ts`, `apps/web/lib/analyzer/keyword-matcher.ts`) tokenizes the job description, ranks significant keywords, and compares them to the CV.

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
