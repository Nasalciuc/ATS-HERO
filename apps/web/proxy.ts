import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/clerk-config";

/**
 * Clerk auth context when keys are configured. Without keys, passthrough so
 * Vercel preview/production still serves Tier 0/1 (guest builder + scoring).
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
