import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk v6+ REQUIRES this middleware to run for auth() / useAuth() / ConvexProviderWithClerk
// to work. Without it you get "auth() was called but Clerk can't detect clerkMiddleware()".
//
// We deliberately do NOT protect any routes here: ATS Hero lets guests build, score, and tailor
// CVs without an account (value-before-paywall). Sign-in is optional and only adds persistence
// across devices + claiming the guest's work. So plain clerkMiddleware() (all routes public) is
// exactly what we want. If a route ever needs protection, switch to the createRouteMatcher form.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Run on everything except Next internals and static files (unless referenced in a query).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
