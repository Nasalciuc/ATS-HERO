import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/clerk-config";
import { allow } from "@/lib/ratelimit";

/**
 * Clerk auth context when keys are configured. Routes stay public on purpose
 * (value-before-paywall): guests use the builder; sign-in only persists/claims.
 * Next.js 16 uses this `proxy.ts` file (not `middleware.ts`).
 *
 * Rate limiting rides along here so both the AI route and Server Actions are covered
 * before they reach a Function.
 */
function tooManyRequests(req: NextRequest, userId: string | null): NextResponse | null {
  const path = req.nextUrl.pathname;
  const isRewrite = path.startsWith("/api/rewrite");
  const needsLimit =
    req.method === "POST" && (isRewrite || Boolean(req.headers.get("next-action")));
  if (!needsLimit) return null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "ip";
  const key = `${isRewrite ? "rw" : "act"}:${ip}:${userId ?? "anon"}`;
  const limit = isRewrite ? 10 : 30;
  if (allow(key, limit, 60_000)) return null;
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}

const handler = isClerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      const { userId } = await auth();
      return tooManyRequests(req, userId) ?? undefined;
    })
  : (req: NextRequest) => tooManyRequests(req, null) ?? NextResponse.next();

export default handler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
