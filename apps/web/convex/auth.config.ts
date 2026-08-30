// Wires Clerk as the Convex auth provider.
// Set CLERK_JWT_ISSUER_DOMAIN as a Convex env var to your Clerk Frontend API URL.
// "applicationID" must match the JWT template name in Clerk ("convex").
export default {
  providers: [
    {
      // Convex dashboard env wins; fallback matches the current Clerk Frontend API
      // (decoded from NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).
      domain:
        process.env.CLERK_JWT_ISSUER_DOMAIN ??
        "https://giving-peacock-94.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
