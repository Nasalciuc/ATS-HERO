# ATS Hero

ATS Hero helps job seekers build ATS-friendly CVs, score them against applicant tracking systems, and match them to job descriptions.

Production app: **Next.js 16** in `apps/web/` (deploy to Vercel with Root Directory = `apps/web`).

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture spec.

## Stack

| Layer | Technology | Location |
| --- | --- | --- |
| Web app | Next.js 16.2 + React 19.2 | `apps/web/` |
| Backend | Convex + Clerk | `apps/web/convex/` |
| AI / NLP | FastAPI + spaCy | `apps/ai/` |
| Shared data | JSON detector packs | `packages/shared/` |

## Monorepo layout

```
apps/
  web/          Next.js production frontend (Vercel)
  ai/           Python FastAPI (Tier 2–3)
packages/
  shared/       Shared JSON data
tools/
  scripts/      Figma download, Playwright audit
reference/figma/  Design reference PNGs
tests/          Screenshot audit outputs
```

## Getting started

```bash
cd apps/web
npm install
npm run dev        # http://localhost:3000
npm run build
```

Or from repo root:

```bash
npm run dev
npm run build
```

### Convex + Clerk (required for persistence)

```bash
cd apps/web
npx convex dev
```

Set Clerk keys in `apps/web/.env.local` and `CLERK_JWT_ISSUER_DOMAIN` in the Convex dashboard.

## Vercel deployment

**Prerequisite (FAZA 1, local, interactive):** run once from `apps/web`:

```bash
npx convex dev
```

This links the Convex project, generates `convex/_generated/` (gitignored), and writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Without this step, `next build` fails with `Cannot find module '@/convex/_generated/api'`.

### Vercel project settings

1. **Root Directory:** `apps/web`
2. **Build command:** `npx convex deploy --cmd 'npm run build'` (also in `apps/web/vercel.json`)
3. **Install command:** `npm ci`

If `_generated` is still missing at build time, use the fallback:

```bash
npx convex deploy && npm run build
```

### Environment variables (Production)

| Variable | Where | Notes |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | Vercel only | Convex Dashboard → Project Settings → Generate Production Deploy Key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel | Clerk API keys |
| `CLERK_SECRET_KEY` | Vercel | Clerk API keys |
| `CLERK_JWT_ISSUER_DOMAIN` | **Convex** dashboard | Clerk Frontend API URL; JWT template named `convex` |

Do **not** set `NEXT_PUBLIC_CONVEX_URL` manually on Vercel — `convex deploy` injects it during the build.

Clerk production auth requires a **custom domain** (not `*.vercel.app`).

## Testing

```bash
cd apps/web && npm test          # Vitest — scoring + jobfit
npm run audit:screenshots        # Playwright (Next.js on :3000)
```

## License

Private — see repository owner for usage terms.
