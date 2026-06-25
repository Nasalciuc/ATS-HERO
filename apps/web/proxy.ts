import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Enables Clerk auth context across the app, but gates NOTHING — every route stays
 * accessible to guests. Sign-in is opt-in (only to persist work). When Tier 2/3
 * gating is introduced, switch to createRouteMatcher + auth.protect() here.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
