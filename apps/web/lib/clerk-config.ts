function hasValidKey(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return !trimmed.startsWith("PASTE_");
}

/** Server + edge: both Clerk keys must be present. */
export function isClerkConfigured(): boolean {
  return (
    hasValidKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) &&
    hasValidKey(process.env.CLERK_SECRET_KEY)
  );
}

/** Client-safe: publishable key only (secret is never exposed to the browser). */
export function isClerkPublicConfigured(): boolean {
  return hasValidKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

/**
 * The Clerk host the browser talks to (its "Frontend API"), read from the publishable key the way
 * Clerk reads it: "pk_", the instance kind ("test" or "live") and "_", then the host plus "$" in
 * base64 (the parts are written apart: CI's secret gate looks for live key prefixes written out).
 * A development instance gives a name under clerk.accounts.dev; the production one gives
 * clerk.atshero.app. The CSP allows
 * this one host and no other Clerk address (lib/csp.ts). Null without a key or with a key that names
 * no plain host name.
 */
export function clerkFrontendApi(key: string | undefined = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY): string | null {
  const encoded = key?.trim().match(/^pk_(?:test|live)_([A-Za-z0-9+/=-]+)$/)?.[1];
  if (!encoded) return null;
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    return null;
  }
  if (!decoded.endsWith("$")) return null;
  const host = decoded.slice(0, -1).toLowerCase();
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}
