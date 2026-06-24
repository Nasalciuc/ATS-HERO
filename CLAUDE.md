# CLAUDE.md — ATS Hero Production Rewrite

## MISSION

You are rewriting ATS Hero from a Vite + Express proof-of-concept into a production-grade Next.js 16 + Convex + Clerk monolith modular. This is NOT an incremental migration — it is a full rewrite that preserves business logic but replaces every infrastructure layer.

The source prototype lives at `github.com/Nasalciuc/ATS-HERO`. The target is a new monorepo with `apps/web/` (Next.js 16), `apps/ai/` (Python FastAPI), and `convex/` (Convex backend).

> Scaffolding status: the production file tree exists as **empty placeholders**. Implement each file per this spec. The prototype (`src/`, `server/`, Vite configs) remains at the repo root during the transition and is the source to PORT FROM.

---

## CURRENT PROTOTYPE (what we're rewriting FROM)

```
ATS-HERO/ (Vite + Express + JSON file store)
├── server/                    ← Express backend (REPLACING with Convex)
│   ├── index.ts               ← Express app, JWT auth, routes
│   ├── scoring.ts             ← ATS scoring engine ★ PORT THIS LOGIC
│   ├── jobfit.ts              ← Job-CV matching ★ PORT THIS LOGIC
│   ├── auth.ts                ← JWT + bcrypt (REPLACING with Clerk)
│   └── data/db.json           ← File-based store (REPLACING with Convex)
│
├── src/                       ← React 18 SPA (REPLACING with Next.js 16)
│   ├── components/
│   ├── pages/
│   ├── store/AppContext.tsx   ← Auth + CV state + autosave ★ PORT PATTERN
│   ├── lib/                   ← Types + API client
│   └── styles.css             ← ALL styles + design tokens ★ PORT TOKENS
│
├── public/images/             ← Figma exports ★ COPY DIRECTLY
├── reference/figma/           ← Figma page references
├── postman/                   ← API test collections
├── tests/screenshots/         ← Playwright test screenshots
└── .env.example               ← Has hardcoded secrets ⚠️ NEVER COPY
```

### CRITICAL BUSINESS LOGIC TO PORT

**1. ATS Scoring Engine (`server/scoring.ts`)**
Scores each CV section 0-100 on completeness, content quality (action verbs, specificity), measurable results, keyword richness, formatting. Produces per section: `criticalMistakes`, `suggestions`, `goodPractices`. The general score weights five core sections and adds bonus for optional sections.

PORT TO: `apps/web/lib/analyzer/ats-scorer.ts` (simplified client-side Tier 1) AND `apps/ai/app/analyzers/ats_scorer.py` (full Python version with spaCy NLP for Tier 2).

**2. Job Fit Matcher (`server/jobfit.ts`)**
Tokenizes the job description, identifies significant keywords (filtering stop words, ranking by TF-IDF-like scoring), compares against CV content. Returns match percentage + matched/missing keywords.

PORT TO: `apps/web/lib/analyzer/keyword-matcher.ts` AND `apps/ai/app/analyzers/job_matcher.py`.

**3. Guest → Claim Flow (`src/store/AppContext.tsx`)**
CVs created anonymously (localStorage). On sign-in the CV is "claimed" — associated with the account. PLG conversion mechanism.

PORT TO: Zustand store (`stores/cv-builder-store.ts`) + Convex mutation (`cvs.claimGuestCv`). Clerk handles the auth transition.

### DESIGN TOKENS TO PORT (from `src/styles.css` → `tailwind.config.ts`)

```ts
colors: {
  'page-bg': '#F5F3FF',
  'dark-section': '#2E2E2E',
  'features-bg': '#D6F7E2',
  'green-accent': '#00C450',
  'green-ring': '#00DE81',
  'green-light': '#D6F7E2',
  'violet': '#725BFE',
  'violet-light': '#D9D2FF',
  'violet-muted': '#B2A5FF',
  'error': '#FF6161',
  'text-primary': '#1A1A1A',
  'text-secondary': '#6B7280',
  'border': '#E5E7EB',
  'surface': '#FFFFFF',
},
fontFamily: {
  'heading': ['Helvetica', 'Arial', 'sans-serif'],
  'body': ['Helvetica', 'Arial', 'sans-serif'],
  'badge': ['Inter', 'sans-serif'],
},
```

---

## TARGET ARCHITECTURE

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16.2.x (App Router, Turbopack) | SSR, Server Components, Server Actions, React Compiler |
| React | 19.2.x | UI rendering (View Transitions) |
| Styling | Tailwind CSS 3.x + Shadcn UI | Utility CSS + component library |
| State (local) | Zustand 5.x | CV builder wizard state, UI state |
| Forms | React Hook Form 7.x + Zod 3.x | Form management + validation |
| PDF generation | @react-pdf/renderer 4.x | Client-side PDF creation |
| PDF preview | pdfjs-dist 4.x | Pixel-accurate preview + text extraction |
| Backend | Convex | Document DB, reactive queries, file storage, actions |
| Auth | Clerk Pro | Auth with prebuilt UI + Convex integration |
| AI | Vercel AI SDK 4.x | Multi-provider (OpenAI + Anthropic + Google) |
| NLP | spaCy 3.x (Python) | Keyword extraction, NER, deterministic scoring |
| Python API | FastAPI 0.11x | Python module HTTP interface |
| Payments | Stripe 17.x | Checkout, Portal, Webhooks |
| Monitoring | Sentry 8.x | Errors + session replays |
| Analytics | SimpleAnalytics | PLG funnel, GDPR cookieless |
| Feature flags | DevCycle | Paywall experiments |
| Secrets | Doppler | Centralized secret management |
| Testing | Vitest + Playwright | Unit/integration + E2E |
| CI/CD | GitHub Actions | Automated test + deploy |

---

## IMPLEMENTATION RULES

1. App Router ONLY. No `pages/`. Route groups: `(marketing)`, `(auth)`, `(app)`, `(guest)`.
2. Server Components by default. `"use client"` ONLY when needed (state, effects, handlers, Zustand, RHF, Convex hooks, Clerk hooks, Framer Motion, pdfjs, @react-pdf/renderer).
3. Convex for ALL data. Guest mode uses localStorage via Zustand, claimed on sign-in via Convex mutation.
4. Clerk for ALL auth. No custom JWT/login forms. Use `<SignIn/>`, `<SignUp/>`, `<UserButton/>`, `clerkMiddleware()`.
5. Zustand for LOCAL state only.
6. React Hook Form + Zod for ALL forms.
7. Shadcn UI for ALL UI components.
8. No `fetch()` to Convex — use hooks (client) / `fetchQuery`/`fetchMutation` (server).
9. Python module is INTERNAL ONLY. Called only from Next.js Server Actions or Convex Actions via shared API key.
10. One push, three deploys (Vercel + Convex + DigitalOcean).

---

## FEATURE TIERS

| Tier | What | Where | Cost | Auth |
|------|------|-------|------|------|
| Tier 0 | CV Builder + PDF export (watermarked) | Client | €0 | No |
| Tier 1 | PDF text extraction + basic ATS score | Client | €0 | No |
| Tier 2 | DOCX + spaCy NLP + deterministic score + full recs | Python | €0 | Yes (free) |
| Tier 3 | AI deep analysis + summary + rewrite + job fit AI + no watermark | Python + LLM | ~$0.01/scan | Yes (paid) |

---

## SCORING ENGINE PORT GUIDE

Port `server/scoring.ts` to TWO targets, preserving the original weights and section rules so scores are comparable:

- **`lib/analyzer/ats-scorer.ts`** — Tier 1, in-browser, regex/heuristics only.
- **`apps/ai/app/analyzers/ats_scorer.py`** — Tier 2, spaCy NER + TF-IDF-like weighting + per-section breakdown.

---

## KEY PATTERNS TO PRESERVE

1. Anonymous CV creation → claim on sign-in (Zustand+localStorage → Convex `claimGuestCv`).
2. Autosave on step change (validate Zod → Zustand → debounced Convex mutation → next step).
3. Multi-entry with tabs (Education, Work Experience).
4. Dynamic stepper: core steps (Contacts, Education, Professional summary, Work, Skills) + optional removable (Awards, Volunteering, Certification) + "+ Add section". Connected line; active = green text; completed = green connector.

See the full Convex schema and component contracts in the original brief.
