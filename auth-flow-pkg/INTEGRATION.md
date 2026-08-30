# Auth + persistence flow — what's done, what this adds, how to verify the KPI

## Status (verified against the real repo)

The flow was already ~80% built and well-built. **Don't rebuild these:**

| Layer | Piece | State |
|-------|-------|-------|
| 1. Auth wiring | `ClerkProvider` → `ConvexProviderWithClerk` → `AppProvider` | ✅ done |
| 1. Auth wiring | `convex/auth.config.ts` (Clerk as Convex provider) | ✅ done |
| 1. Auth wiring | **`middleware.ts`** | ❌ **was missing → added here** |
| 2. Persistence | Convex `cvs` / `scans` / `users` mutations + queries | ✅ done |
| 2. Persistence | `lib/api.ts` (Convex-backed data layer) | ✅ done |
| 2. Persistence | `lib/convexClient.ts` (single client + `getGuestId`) | ✅ done |
| 2. Persistence | AppContext autosave (800ms debounce → `updateCv`) | ✅ done |
| 2. Persistence | `useCvs()` reactive list | ✅ done |
| 3. Guest → claim | `cvs.claimGuest` mutation (re-assigns guest cvs + scans) | ✅ done |
| 3. Guest → claim | AppContext fires `ensureUser` + `claimGuest` on sign-in | ✅ done |
| 4. Dashboard | `/app` index listing CVs | ❌ **was missing → added here** |
| polish | `hooks/use-cv.ts`, `hooks/use-scans.ts` | placeholders → filled here |
| Tier 3 | `hooks/use-subscription.ts` | left as placeholder (Stripe later) |

## What this package adds
1. **`apps/web/middleware.ts`** — the required Clerk middleware (all routes public; guests use the
   app freely). **This is the critical fix** — without it Clerk/`auth()` don't work at all.
2. **`apps/web/app/app/page.tsx`** — the dashboard: reactive list of CVs (`useCvs`), New CV, open,
   delete, guest banner + sign-in. Works for guests and signed-in users.
3. **`apps/web/hooks/use-cv.ts`** — reactive single-CV reader (for read-only/preview/share).
4. **`apps/web/hooks/use-scans.ts`** — re-exports `useScans` (kills the placeholder).
5. **`APPCONTEXT-PATCH.md`** — adds `openCv(id)` to AppContext (3 small edits) so the dashboard can
   open a card into the builder.

## Integration order
1. Copy `middleware.ts` to `apps/web/` (repo root of the Next app, next to `next.config.ts`).
2. Apply `APPCONTEXT-PATCH.md` (adds `openCv`).
3. Copy the dashboard page + the two hooks.
4. Make sure `nanoid` is installed (used by `lib/convexClient.ts`): `npm i nanoid` in `apps/web`.
5. `npx tsc --noEmit` in `apps/web` (will pass once `convex/_generated/` exists — see below).

## Verify the KPI end-to-end (guest → sign-in → claim → persist)
With Convex running (`npx convex dev`) + Clerk keys set:
1. **As a guest** (signed out), go to `/app/create`, fill in some fields. Wait ~1s.
   → A `cvs` row appears in the Convex dashboard with a `guestId` and no `ownerId`. *(If no row
   appears, the builder created edits but never called `ensureCv`/`save` — make sure the builder
   calls `save()` / `ensureCv()` once so the guest CV is persisted before sign-in.)*
2. Open `/app` → the guest CV shows in the dashboard.
3. **Sign in** (Google or email). AppContext's effect fires `ensureUser` + `claimGuest(guestId)`.
   → In Convex, that `cvs` row now has your `ownerId` and `guestId: undefined`; a `users` row exists.
4. **Refresh** `/app` → the CV is still there, now owned by your account.
5. Open it on a **second device / browser** (same sign-in) → it appears (multi-device).

That round trip passing = the KPI is green.

## Notes
- `middleware.ts` keeps every route public on purpose (value-before-paywall). Don't add route
  protection — sign-in is optional and only adds persistence + claim.
- The dashboard uses raw Convex docs from `useCvs()` (`cv._id`, `cv.title`, `cv.updatedAt`), not the
  mapped `Cv` type — that's intentional (reactive query returns `Doc<"cvs">`).
- Tailwind classes assume the violet/zinc palette; adjust to your tokens if needed.
