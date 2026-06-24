// Wires Clerk as the Convex auth provider.
// Set CLERK_JWT_ISSUER_DOMAIN as a Convex env var (Convex Dashboard → Settings →
// Environment Variables) to your Clerk Frontend API URL, e.g.
//   https://your-app.clerk.accounts.dev
// "applicationID" must match the name of the JWT template you create in Clerk ("convex").
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
