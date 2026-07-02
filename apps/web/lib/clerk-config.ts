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
