// The public origin and the public routes, in one place: sitemap.ts, robots.ts and the pages'
// canonical URLs read from here. Add a public page here; tests/sitemap.test.ts fails until you do.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://atshero.app").replace(/\/$/, "");

/** Routes Google may index. lastModified comes from the page's own *_UPDATED constant where one exists. */
export const PUBLIC_ROUTES = ["/", "/privacy", "/terms", "/credits", "/blog"] as const;
export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

/**
 * Public routes with a parameter: every page they match is public too. The sitemap lists each page
 * (each blog post, with its own date); the cookie banner and the public CSP match them by pattern.
 * A [param] stands for exactly one path segment.
 */
export const PUBLIC_ROUTE_PATTERNS = ["/blog/[slug]"] as const;

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

/** Does a path match a route pattern such as "/blog/[slug]"? Each [param] is one non-empty segment. */
export function matchesRoutePattern(pattern: string, pathname: string): boolean {
  const source = pattern
    .split("/")
    .map((part) => (/^\[[^\]/]+\]$/.test(part) ? "[^/]+" : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${source}$`).test(pathname);
}

/** The same pattern written for next.config headers(): "/blog/[slug]" becomes "/blog/:slug". */
export function headerSource(pattern: string): string {
  return pattern.replace(/\[([^\]/]+)\]/g, ":$1");
}
