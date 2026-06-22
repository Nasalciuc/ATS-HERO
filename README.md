# ATS Hero — Full-Stack Web App

A faithful implementation of the **ATS Hero** product (the “✅ User flow (Desktop)” designs) from the Figma source file, built as a real full-stack web application.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + React Router
- **Backend:** Express (run via `tsx`) with JWT auth, a JSON file store, a real ATS scoring engine, and keyword-based job-fit matching
- **Styling:** Plain CSS with design tokens transcribed 1:1 from Figma (`src/styles.css`)
- **Assets:** Real images exported from Figma into `public/images/`

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` runs the web app and the API together (via `concurrently`):

- Web: http://localhost:5173 (falls back to 5174 if the port is busy)
- API: http://localhost:8787 (the web server proxies `/api` → 8787)

Run them separately if you prefer: `npm run web` and `npm run server`.

## Build

```bash
npm run build      # type-checks + builds the frontend
npm run preview
```

## Routes (frontend)

| Route | Screen |
| --- | --- |
| `/` | Landing page (hero, tool, features, testimonials, FAQ, footer) |
| `/app/create` | **Function 1** — Create CV wizard (Personal info → Education → Summary → Work → Skills + optional sections) |
| `/app/improve` | **Function 2** — Improve CV (paste/upload → ATS analysis) |
| `/app/jobfit` | **Function 3** — Job Fit (CV + job description → match score) |
| `/app/score` | ATS Score Results (gauge + per-section breakdown) |

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Email-first sign in (upserts user, returns JWT) |
| `GET` | `/api/auth/me` | Current user |
| `GET/POST` | `/api/cv` | List / create CVs |
| `GET/PUT/DELETE` | `/api/cv/:id` | Read / update / delete a CV |
| `POST` | `/api/score` | ATS score from `{ data }`, `{ cvId }` or raw `{ text }` |
| `POST` | `/api/jobfit` | Match a CV against a job description |

CVs can be created anonymously (persisted via `localStorage`) and are claimed by your
account when you sign in. Data is stored in `server/data/db.json`.

## ATS scoring engine (`server/scoring.ts`)

Each section is scored 0–100 on completeness, content quality, measurable results,
keyword richness and formatting, producing **critical mistakes**, **suggestions** and
**good practices**. The general score weights the five core sections and adds a small
bonus for optional sections. Job-fit (`server/jobfit.ts`) tokenizes the job description,
ranks the most significant keywords, and compares them to the CV.

## Project structure

```
public/images/        Exported Figma assets
reference/figma/       Downloaded page/screen references + manifest.json
scripts/               Figma page export helper
server/                Express API (auth, cv, scoring, jobfit, file store)
src/
  components/          Landing sections, app shell, UI kit, modals, icons, CV renderer
  pages/               LandingPage, BuilderPage, AnalyzePage, ScorePage + wizard steps
  store/AppContext.tsx Auth + CV state with autosave
  lib/                 Shared types + API client
  styles.css           Design tokens + all styles
```

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
