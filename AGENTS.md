# AGENTS.md

## Cursor Cloud specific instructions

This repo is a **monorepo in transition** (see `CLAUDE.md` / `README.md`). Three independent
dependency roots, each runs on its own:

| Service | Path | Stack | Runs without secrets? |
| --- | --- | --- | --- |
| Production web app | `apps/web` | Next.js 16 + Convex + Clerk | ✅ yes (see Convex/Clerk notes) |
| AI / NLP service | `apps/ai` | Python FastAPI + spaCy | ✅ yes |
| Legacy prototype | repo root (`src/` + `server/`) | Vite + Express | ✅ yes |

The update script (run automatically on startup) installs all deps: root `npm install`,
`apps/web` `npm install`, and the `apps/ai/.venv` + pip. It does **not** start services.

### Running the production web app (`apps/web`) — non-obvious startup

`apps/web` depends on `convex/_generated/` (gitignored) and `NEXT_PUBLIC_CONVEX_URL`
(in `apps/web/.env.local`, gitignored). Both are produced by Convex codegen, **not** by the
update script. There is no Convex account/login in this environment — use Convex's **anonymous
local deployment** (downloads a local backend binary, no account):

```bash
cd apps/web
# 1) First run only: configure a local anonymous deployment (creates .env.local + convex/_generated/)
CONVEX_AGENT_MODE=anonymous npx convex dev --once --configure new --dev-deployment local
# 2) The auth config needs an issuer var on the local backend (any placeholder is fine for guest flows):
CONVEX_AGENT_MODE=anonymous npx convex env set CLERK_JWT_ISSUER_DOMAIN https://example.clerk.accounts.dev
# 3) Push functions + keep the local backend running (leave this running in its own terminal):
CONVEX_AGENT_MODE=anonymous npx convex dev
# 4) In a second terminal, start Next.js:
npm run dev   # http://localhost:3000
```

- **Clerk runs in keyless mode automatically** when no Clerk keys are set — Next.js generates
  temporary dev keys, so the app boots and all routes return 200 without any secret. Sign-in is
  opt-in and gates nothing; guest flows need no auth. (To exercise real sign-in, set
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` in `apps/web/.env.local`.)
- `.env.local`, `convex/_generated/`, and `apps/web/.clerk/` are gitignored, per-environment
  artifacts — do not commit them.

### Known pre-existing app bugs (NOT environment issues)

The client data layer is out of sync with the Convex function file layout:
- `apps/web/lib/api.ts` and `apps/web/hooks/use-cvs.ts` call `api.cvs.create` / `api.cvs.listMine`,
  but the functions live in `convex/cvs/mutations.ts` + `convex/cvs/queries.ts`, so the real
  references are `api.cvs.mutations.create` / `api.cvs.queries.listMine`.
- Effect: CV builder **autosave to Convex fails** at runtime ("Could not find public function for
  'cvs:create'") and `next build` fails TypeScript checking on `hooks/use-cvs.ts`.
- The CV builder UI and the **client-side ATS scoring / job-fit** (`lib/analyzer/*`, used by
  `/app/improve`, `/app/jobfit`, `/app/score`) work fully — scoring never touches Convex.
- `next dev` is unaffected (no upfront full typecheck). Use **dev mode** for the web app.

### AI service (`apps/ai`)

```bash
cd apps/ai && . .venv/bin/activate
uvicorn app.main:app --reload --port 8000   # docs at /docs
```
- The spaCy model `en_core_web_sm` is **optional**; the service falls back to a blank pipeline
  (`/health` reports `model_loaded`). It is pre-installed in `.venv` in this environment. To
  reinstall: `python -m spacy download en_core_web_sm`.

### Tests & lint

- Legacy scoring/job-fit unit tests (Vitest), run from repo root: `npx vitest run`.
- AI service tests: `cd apps/ai && . .venv/bin/activate && pytest` (run in spaCy fallback mode).
- **No lint is configured.** `apps/web`'s `npm run lint` (`next lint`) is broken — Next.js 16
  removed the `next lint` command and there is no ESLint config. The root project has no lint script.

### Legacy prototype (reference only)

From repo root: `npm run dev` (Vite :5173 + Express :8787), or `npm run server` / `npm run web`.
See `README.md` for routes and Postman/Newman API testing.
