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

1. **Root Directory:** `apps/web`
2. **Build command:** `npm run build` (default)
3. **Install command:** `npm ci`
4. Env vars: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, etc.

`apps/web/vercel.json` pins the Next.js framework.

## Testing

```bash
cd apps/web && npm test          # Vitest — scoring + jobfit
npm run audit:screenshots        # Playwright (Next.js on :3000)
```

## License

Private — see repository owner for usage terms.
