# Legacy cleanup investigation (Phase A)

Approved cleanup executed on branch `chore/remove-legacy-vite-root`.

## Summary

- **Live app** (`apps/web`, `apps/ai`, `packages/`) had **zero imports** from root `src/`, `server/`, or `public/`.
- **Scoring/jobfit logic** ported to `apps/web/lib/analyzer/`; **44 Vitest tests** migrated from `server/*.test.ts`.
- **Python `apps/ai/`** complements (does not replace) Tier 1 section scoring.
- **Convex `_generated/`** still requires `npx convex dev` — separate human task.

## Root item decisions

| Item | Decision | Reason |
| --- | --- | --- |
| `src/` | DELETE | UI + types fully ported to `apps/web/` |
| `server/` | DELETE (after test migration) | Logic in `apps/web/lib/analyzer/` |
| `vite.config.ts`, `index.html` | DELETE | Vite prototype removed |
| root `package.json` + lockfile | REWRITE | Was Vite build; now thin orchestrator |
| root `public/` | DELETE | Duplicated in `apps/web/public/` |
| `ats-hero-pieces/` | DELETE | Staging folder, content merged |
| `sentry.*.config.ts` | DELETE | Empty placeholders, not wired |
| `scripts/` | MIGRATE → `tools/scripts/` | Dev tooling kept |
| `postman/` | MIGRATE → `tools/postman/` | Archived legacy Express API |
| `reference/` | KEEP | Figma design assets |
| `CLAUDE.md`, `.github/` | KEEP | Project spec + CI |

## Vercel

Root Directory = `apps/web`. Added `apps/web/vercel.json`.
