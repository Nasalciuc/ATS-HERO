import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/clerk-config";

/**
 * Clerk auth context when keys are configured. Routes stay public on purpose
 * (value-before-paywall): guests use the builder; sign-in only persists/claims.
 * Next.js 16 uses this `proxy.ts` file (not `middleware.ts`).
 */
const handler = isClerkConfigured()
  ? clerkMiddleware()
  : (_req: NextRequest) => NextResponse.next();

export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
