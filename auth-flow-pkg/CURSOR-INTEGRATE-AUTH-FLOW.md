# Cursor Agent — integrate the auth + persistence flow (gap fillers)

Paste this entire file into Cursor Agent inside `apps/web` of the `Nasalciuc/ATS-HERO` monorepo.

**Mission.** The auth + persistence + guest-claim flow is already ~80% built and well-built — the
Convex backend (incl. `cvs.claimGuest`), the Clerk + Convex providers, `lib/api.ts`, AppContext
autosave + claim-on-sign-in, and `useCvs()` all exist and work. This task adds only the **missing
pieces**: the required Clerk **middleware**, the **dashboard** page, two **hook** implementations,
and one small **AppContext** method. Do NOT rebuild the parts that already exist.

> You can read the real code. For each step: **read the target first, confirm the assumption,
> then wire.** If reality differs from what's described, adapt and leave a `// TODO(integration):`
> note rather than overwriting working code.

---

## 0. What NOT to touch (already done — verify, don't rewrite)
- `convex/` (schema, `cvs`/`scans`/`users` mutations+queries, `claimGuest`, validators, auth.config)
- `app/layout.tsx`, `app/providers.tsx`, `providers/convex-clerk-provider.tsx`
- `lib/api.ts`, `lib/convexClient.ts`
- `store/AppContext.tsx` — **except** the one additive `openCv` method in Step 2
- `hooks/use-cvs.ts` (`useCvs` + `useScans` live here)
- `hooks/use-subscription.ts` — leave as placeholder (Tier 3 / Stripe, deferred)

## 1. Provided files (copy in as-is)
| File | Destination | Action |
|------|-------------|--------|
| `middleware.ts` | `apps/web/middleware.ts` | new (next to `next.config.ts`) |
| `app/app/page.tsx` | `apps/web/app/app/page.tsx` | new (the `/app` dashboard index) |
| `hooks/use-cv.ts` | `apps/web/hooks/use-cv.ts` | replace placeholder |
| `hooks/use-scans.ts` | `apps/web/hooks/use-scans.ts` | replace placeholder |

## 2. Pre-flight — read + confirm (report a 3-line summary, then proceed)
1. Confirm `apps/web/middleware.ts` does **not** exist (it's the critical gap).
2. Confirm `apps/web/app/app/page.tsx` does **not** exist (no `/app` index today; only
   `create`/`improve`/`jobfit`/`score` subroutes).
3. Open `store/AppContext.tsx` and confirm it exposes `cv, data, ensureCv, update, save, reset`
   and a `CV_ID_KEY` localStorage constant, and that it already fires `ensureUser` + `claimGuest`
   on sign-in. (You'll add `openCv` alongside `ensureCv`.)
4. Confirm `hooks/use-cvs.ts` exports `useCvs` and `useScans`, and `lib/convexClient.ts` exports
   `getGuestId` + the shared `convex` client.
5. Confirm `nanoid` is a dependency (used by `lib/convexClient.ts`); if missing, you'll add it.

## 3. Step 1 — add `middleware.ts` (CRITICAL)
Copy the provided `middleware.ts`. This is required: without `clerkMiddleware()` running, Clerk /
`auth()` / `ConvexProviderWithClerk` fail ("can't detect clerkMiddleware()"). It keeps **all routes
public on purpose** (guests use the whole app; sign-in is optional — value-before-paywall). Do not
add route protection.

## 4. Step 2 — AppContext: add `openCv(id)` (3 small edits — DO NOT rewrite the file)
The dashboard opens a saved CV into the editor via a new `openCv`. Make exactly these edits:

**(a)** In the `AppState` type, beside `ensureCv`:
```ts
  ensureCv: () => Promise<string>;
  openCv: (id: string) => Promise<void>;   // add
```
**(b)** Add the callback right after the existing `ensureCv` useCallback:
```ts
  const openCv = useCallback(async (id: string): Promise<void> => {
    const { cv } = await api.getCv(id);
    setCv(cv);
    setData(cv.data);
    if (typeof window !== "undefined") localStorage.setItem(CV_ID_KEY, cv.id);
  }, []);
```
**(c)** Add `openCv` to BOTH the `value` object and its dependency array in the `useMemo`.

It reuses the existing `api.getCv` + the same `CV_ID_KEY` the restore effect uses, so opening from
the dashboard behaves exactly like reloading.

## 5. Step 3 — dashboard
Copy the provided `app/app/page.tsx`. It:
- lists CVs reactively via `useCvs()` (works for guests AND signed-in users),
- has New CV (`reset()` → `/app/create`), Open (`openCv(id)` → `/app/create`), Delete
  (`api.deleteCv` — reactive),
- shows a guest banner + Clerk `SignInButton` / `UserButton`.
It uses raw Convex docs (`cv._id`, `cv.title`, `cv.updatedAt`) from `useCvs()` — that's intentional
(the reactive query returns `Doc<"cvs">`, not the mapped `Cv`).

## 6. Step 4 — hooks
Copy the provided `hooks/use-cv.ts` (reactive single-CV reader using `cvs.getById` + the `"skip"`
pattern) and `hooks/use-scans.ts` (re-exports `useScans` from `use-cvs`, killing the placeholder).

## 7. Step 5 — deps
```bash
cd apps/web && npm i nanoid
```
(Only if pre-flight found it missing.)

## 8. Guardrails — do NOT
- Do **not** rewrite `AppContext`, `lib/api.ts`, `lib/convexClient.ts`, or anything in `convex/`.
- Do **not** add route protection in `middleware.ts` — all routes stay public.
- Do **not** implement `use-subscription.ts` (Tier 3, deferred).
- Do **not** run/fix `npx convex dev` or `convex/_generated/` (separate, human-interactive task).
- Do **not** drive the builder's editing state from `useCv` (a live query must never overwrite
  in-progress edits — AppContext owns the editable buffer).
- If a target file differs from the assumptions, adapt minimally and leave a `// TODO(integration)`.

## 9. Verify
```bash
cd apps/web && npx tsc --noEmit
```
(Passes once `convex/_generated/` exists — i.e. after the human runs `npx convex dev`. If `tsc`
fails ONLY on missing `@/convex/_generated/*`, that's the separate Convex blocker, not this work.)

Then the **end-to-end KPI test** (Convex running + Clerk keys set):
1. Signed out, go to `/app/create`, fill some fields, wait ~1s → a `cvs` row appears in Convex with
   a `guestId`, no `ownerId`.
2. `/app` → that guest CV shows in the dashboard.
3. Sign in (Google/email) → AppContext fires `ensureUser` + `claimGuest`; in Convex the row now has
   your `ownerId` and `guestId: undefined`, and a `users` row exists.
4. Refresh `/app` → still there, owned.
5. Same sign-in on another browser → it appears (multi-device).
Round trip green = KPI met.

## 10. The one thing to check while wiring
For `claimGuest` to have anything to claim, a guest CV must already be **persisted** before sign-in.
Confirm the builder calls `ensureCv()` (or `save()`) at least once for a guest — e.g. on first
meaningful edit or step change — so a `cvs` row with the `guestId` exists. If edits only flow
through `update()` and `ensureCv` is never triggered, no guest CV is created and there's nothing to
claim. If that's the case, add a single `void ensureCv()` when the guest first edits, and report it.

## 11. Report when done
Files added, the AppContext edit, `nanoid` status, `tsc` result (and whether the only failure is
the Convex `_generated/` gap), and any `TODO(integration)` left behind.
