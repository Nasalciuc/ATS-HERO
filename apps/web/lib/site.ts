// The public origin and the public routes, in one place: sitemap.ts, robots.ts and the pages'
// canonical URLs read from here. Add a public page here; tests/sitemap.test.ts fails until you do.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://atshero.app").replace(/\/$/, "");

/** Routes Google may index. lastModified comes from the page's own *_UPDATED constant where one exists. */
export const PUBLIC_ROUTES = ["/", "/privacy", "/terms", "/credits"] as const;
export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

/** Routes that exist but must not be indexed: the app itself, the OAuth callback, dev-only pages. */
export const NOINDEX_ROUTES = [
  "/app",
  "/app/create",
  "/app/improve",
  "/app/jobfit",
  "/app/score",
  "/app/tracker",
  "/app/tracker/send",
  "/app/tracker/send/[id]",
  "/app/interview",
  "/app/interview/new",
  "/app/interview/[id]",
  "/app/interview/[id]/report",
  "/sso-callback",
] as const;
