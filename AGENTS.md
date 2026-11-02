# AGENTS.md — ATS Hero

The single source of instructions for every coding agent in this repo (Cursor reads it directly;
Claude Code reads it through `CLAUDE.md`). If this file and the code disagree, the code wins:
stop, say so, and fix this file in its own commit.

## What the product is

A freemium web app for job seekers. Value before any paywall: a guest can build and score a CV
without an account; signing in keeps the work (guest → claim).
- **Create**: a step-by-step CV builder; PDF and DOCX export in ATS-tested templates.
- **Improve**: score an existing CV (pasted text or an uploaded file).
- **Job Fit**: match a CV against a job description.
- **Tracker**: applications (signed-in users only).

## Stack — as it is in the code

| Area | What we use | Where |
|---|---|---|
| Web | Next.js 16 (App Router; `proxy.ts`, not `middleware.ts`), React 19, TypeScript | `apps/web` |
| Data | Postgres + Drizzle ORM; `pg` pool with TLS pinned to the RDS CA. Tests use PGlite with the real migrations | `db/schema.ts`, `drizzle/`, `db/index.ts`, `tests/db/` |
| Auth | Clerk (`@clerk/nextjs`) with our own `SignInModal` (e-mail code + OAuth). No Clerk keys → guest mode | `components/modals/SignInModal.tsx` |
| Server code | Server Actions; each one resolves the owner with `getOwnerId()`, filters by owner (`lib/ownership.ts`) and runs inside `withLog()` | `app/actions/` |
| State | Zustand stores, `AppContext` (autosave), SWR for reads | `stores/`, `store/`, `hooks/` |
| Styling | Hand-written design system (BEM classes) + Tailwind 3 utilities with `preflight: false` and `container: false`. **No shadcn/ui, no UI kit** | `app/styles.css`, `tailwind.config.ts` |
| CV output | `@react-pdf/renderer` templates (Inter, `fonts.ts`), `docx`, `printableCv()` at every output boundary. Every PDF goes through `renderCvPdfBlob()` | `components/cv/templates/`, `lib/exportPdf.tsx`, `lib/exportDocx.ts`, `lib/cv-print.ts` |
| PDF reading | PDF.js in-thread (no worker URL, no CSP change) | `components/cv/CvPagedPreview.tsx`, `lib/pdf.ts`, `lib/ats-read/pdf.ts` |
| Scoring | Tier 1 in the browser, deterministic. Builder CVs: `lib/analyzer/` (its score waits for a Figma frame to be replaced). Uploaded or pasted CVs: the ATS check, **no score** (no ATS gives one without a job): fields read by two readings of the file, a TypeScript port of the lab parser (kept identical by `tools/ats-lab/parity/cases.jsonl`), and findings on the Textkernel/RChilli levels (one table: `lib/ats-read/levels.ts`). Job Fit: the post's requirements met or not (`lib/job-fit.ts`), no percentage. Design: `ATS-REAL-VS-NOI.md` | `lib/analyzer/`, `lib/ats-read/`, `lib/job-fit.ts` |
| Python | FastAPI + spaCy (Tier 2, `/parse-check`, ATS lab); Lambda entry with Mangum + per-user limit. **Not deployed yet** | `apps/ai` |
| AI rewrite | Vercel AI SDK; kill-switch + daily quota in `ai_usage` | `app/api/rewrite` |
| Apply agent | Engine only, **nothing calls it yet**: opens a posting, fills what the plan allows, attaches the CV, stops for the person's approval. Drives agent-browser 0.41.1 (vercel-labs, Apache-2.0), which is **not a dependency** of the app; production will run it in a Vercel Sandbox. Design: `APLICARE-CU-AGENT.md` | `lib/apply/`, `tools/apply-lab/` |
| Payments | Paddle (not Stripe) | `app/api/webhooks/paddle`, `lib/paddle-webhook.ts` |
| Infra | Vercel for the web app. AWS (us-east-1) as CloudFormation, **not deployed yet** | `infra/` (see `infra/README.md`) |

## Map

- `apps/web`:
  - `app/` routes (`icon.svg` is the favicon; `favicon.ico` and `apple-icon.png` are generated from it by `npm run icons`);
  - `views/` pages;
  - `components/` UI (`figma-icons.tsx` and `icon-credits.ts` are generated);
  - `lib/`, `db/`, `drizzle/`;
  - `design-check/` (Figma spec check);
  - `lab/` (ATS lab renderer);
  - `tests/`;
  - `public/fonts/`.
- `apps/ai`: `app/` (routers, analyzers, parsers, `lab/`) and `tests/`.
- `infra/`: AWS stacks; the deploy workflow stays in `infra/github/` until AWS phase F3.
- `tools/ats-lab/fixtures/`: synthetic people only.
- `tools/apply-lab/forms/`: synthetic application forms for the apply agent (localhost only).
- `reference/figma/`: exported Figma frames.
- `packages/shared/data/`: JSON data used by `apps/ai`.
- `auth-flow-pkg/`: legacy and unused. Don't import from it.

## Commands

Windows: run them in **Git Bash** (PowerShell breaks `&&`, `source`, `( … )`).
Node 24, as in CI and on Vercel (`engines` in `apps/web/package.json`). On Node 20 the PDF tests fail:
pdf.js needs `Promise.withResolvers`.

```bash
# web (from apps/web)
npm ci                        # never `npm install` in pipelines (lockfile is the contract)
npm run dev                   # http://localhost:3000, guest mode without Clerk keys
npx tsc --noEmit -p .
npx vitest run
npm run build
npm run design:check          # needs `npm run dev` + local Postgres; 🔒 specs must pass
npm run icons                 # after changing app/icon.svg: regenerates favicon.ico and apple-icon.png
npm run db:migrate            # local DB only; production migrations are manual, after a snapshot
npx tsx --tsconfig lab/tsconfig.json lab/render.tsx      # ATS lab, step 1: render
npm install --no-save agent-browser@0.41.1 && npm run apply-lab   # apply lab; needs a Chrome (AGENT_BROWSER_EXECUTABLE_PATH).
                                   # CI installs it outside the app (--prefix) and points AGENT_BROWSER_BIN at it

# ai (from apps/ai)
python -m venv .venv && source .venv/Scripts/activate    # Linux/Mac: .venv/bin/activate
pip install -r requirements-dev.txt && python -m pytest -q
python -m app.lab.run --fixtures ../../tools/ats-lab/fixtures/personas.json \
  --files ../../tools/ats-lab/out/files --out ../../tools/ats-lab/out   # ATS lab, step 2: score
python -m app.lab.parity --write   # after changing app/lab/parser.py: regenerate the parity cases (see its docstring),
                                   # then port the change to apps/web/lib/ats-read/parse.ts until vitest passes

# infra and graph
cfn-lint infra/*.yaml
graphify update .             # after every change; `graphify explain <Node>` before touching unread code
```

## CI gates (must stay green)

- `ci.yml`:
  - XSS/secret grep gate: the string `dangerouslySetInnerHTML` may not appear anywhere in `apps/web` .ts/.tsx, comments included;
  - vitest, build, pytest.
- `design-check.yml` (PRs touching UI): every 🔒 spec within ±2px of Figma.
- `ats-lab.yml` (PRs touching templates, export or the lab): classic, minimal and DOCX must not FAIL on any extractor.
- `migrate-check.yml`: a schema change needs its committed migration.
- `apply-lab.yml` (PRs touching `lib/apply`, the apply lab, or what the lab's CV is made of: the personas, the templates, `cv-print`): the apply agent passes on every synthetic form.

## Rules

1. **Small steps.**
   - One change per step: run the checks, take a screenshot for UI changes, report, stop.
   - Never mix unrelated changes in one commit.
   - Conventional commit messages in English.
2. **No secrets anywhere in the repo, logs or chat.**
   - Covers `DATABASE_URL`, Clerk and Paddle keys, AWS credentials.
   - They live only in `.env.local`, Vercel and GitHub Secrets.
   - AWS access is SSO/OIDC; no access keys.
3. **Security.**
   - No `dangerouslySetInnerHTML`.
   - Don't widen the CSP (`lib/csp.ts`, used by `next.config.ts`). One exception (Scaler, `MARKETING-CE-FACEM.md` M-1): on the
     **public pages only**, add enumerated hosts per directive (`script-src`, `connect-src`, `img-src`),
     never `*`, each with its reason in the PR. `/app`, `/api` and `/dev` never get a third-party script,
     and their CSP does not change.
   - Validate input with zod; keep the rate limits.
4. **Data.**
   - Every query filters by owner (`lib/ownership.ts`).
   - Never take a user id as an action parameter; only `guestId`.
   - Guest rows are claimed on sign-in.
   - Migrations are additive and never run at build time.
   - `DATABASE_URL` has no `?sslmode=`.
5. **Styling.**
   - Extend `app/styles.css` and the existing Tailwind setup.
   - Don't add shadcn/ui or another kit.
   - Don't re-enable Tailwind preflight or the `container` plugin: the landing drops from 73/73 to 13/73 checks.
6. **Figma is the source of truth for UI.**
   - Figma file key `GZFVjkTUlcnc7yLCwWsorV` (owner: Liubovi).
   - Match a frame with `data-figma` keys + a spec in `design-check/specs/`.
   - Don't change CSS to pass a check without looking at the frame.
   - Never remove `"locked": true` to make CI pass.
   - Screens that have no frame yet are designed in Figma first, not invented in code.
7. **CV output** (templates, export, `cv-print`):
   - Run the ATS lab and look at the PDFs.
   - Contacts never break across lines, blank entries never print, and every PDF is rendered by `renderCvPdfBlob()`, which resets the font glyph cache (`resetGlyphCache()` in `fonts.ts`).
   - Never render PDFs another way.
   - Page breaks follow the rules in `shared.tsx` ("page breaks"; `tests/cv-page-breaks.test.tsx` checks them): build sections with `Section` + entries, and space blocks with the parent's `rowGap`, never a bottom margin (react-pdf moves a node whose bottom margin does not fit to the next page).
   - A template renders `pdfData(data)` (`glyphs.ts`): only characters Inter can draw reach the PDF; anything else would come out as wrong letters from a stand-in font.
   - Text that can be long goes through `breakLongWords()` with the width it sits in (`theme.column`, the SplitRow halves, the sidebar); contacts go through `ContactBar` (shrink to one line). `tests/cv-long-text.test.tsx` checks that nothing leaves its column.
8. **Components.** Don't move, rename or delete components or icons without telling Liubovi first.
9. **Generated files.** Regenerate instead of editing:
   - `node design-check/icons/generate.mjs` produces `components/figma-icons.tsx`, `components/icon-credits.ts` and `design-check/ICON-SOURCES.md`.
   - `npm run credits` produces `components/software-credits.ts` (the Credits page's open-source list) from `package-lock.json`. Run it after changing dependencies; `tests/credits-page.test.tsx` fails while the list is out of date.
10. **Truthful copy.** Text on the site describes what the product actually does today.
11. **Privacy and ethics.**
    - LinkedIn: OAuth sign-in only; no scraping or automation.
    - No real user CVs to third-party parsers without explicit consent + DPA; the lab uses fixtures only.
    - Never apply to real employers with test personas.
    - The apply agent (`lib/apply`) sends an application only on the person's approval of that application and of the form they were shown; types from the CV only contact details and the job marked current, only into a field whose own name says what it is; answers no question itself (every other item, sensitive or not, is the person's, and a sensitive one is never stored); never gets past a CAPTCHA, an e-mailed code or a login, and hands over a field it can't set; never goes to LinkedIn, Indeed Apply or Workday; is tested only on `tools/apply-lab/forms`.
    - **Privacy page** (`views/PrivacyPage.tsx`) lists what we keep, where, for how long, every provider and every cookie or storage key. A change to any of that (a new provider or storage key, another retention, payments, turning on `AI_REWRITE_ENABLED` or `NEXT_PUBLIC_ATS_CHECK_ENABLED`) updates the page and its `PRIVACY_UPDATED` date in the same commit. `tests/privacy-page.test.tsx` checks the numbers and keys it quotes.
    - **Terms page** (`views/TermsPage.tsx`) describes ATS Hero as it is today: free, no AI, no job search. Payments, AI features or job search update it and its `TERMS_UPDATED` date in the same commit; the price and the payment and refund terms go there before anything is charged. No payment provider is named until Scaler chooses one. Who runs ATS Hero and the addresses live in `lib/legal.ts`, shared with the Privacy page. `tests/terms-page.test.tsx` checks what it quotes.
12. **Flags.** `NEXT_PUBLIC_ATS_CHECK_ENABLED` stays off in production until `apps/ai` is deployed behind auth.
13. **AWS.**
    - Don't create by hand what `infra/*.yaml` describes.
    - Don't move `infra/github/infra-deploy.yml` into `.github/workflows/`; that's phase F3, done by Scaler.
14. **Push, PR, deploy:** only when Scaler says so.

## Known traps

- `next dev` rewrites `apps/web/next-env.d.ts`. Restore it with `git checkout -- apps/web/next-env.d.ts`; it is not a change.
- On Windows the design check's text boxes can differ by a few px (fonts). The CI run on Linux is the referee.
- The ATS lab's numbers are the baseline: classic 97.3, minimal 97.9, DOCX 100, modern 84.1. A drop needs a reason.
  - Modern was 84.4 before `fix(cv): long names, links and lists stay inside their column`. A 63-character LinkedIn link that used to run invisibly past the sidebar now wraps, and the extractors read it in two pieces.

## Where the decisions are

The design documents live in the claude.ai Project "App Builder", not in the repo:
- `FIGMA-FIDELITY-PLAN.md`
- `ATS-LAB-DESIGN.md`
- `ATS-REAL-VS-NOI.md` (how real ATSs judge a CV, and why our check has no score)
- `AWS-INFRA-DESIGN.md`
- `RESUME-MATCHER-CV-VARIANTS.md`
- `PLAN-CE-URMEAZA.md`

The project principles are in `.specify/memory/constitution.md`. If a task contradicts this file, stop and ask.
