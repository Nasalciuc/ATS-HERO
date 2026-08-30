"use client";
import type { ReactNode } from "react";
import { AppProvider } from "@/store/AppContext";

export default function Providers({ children }: { children: ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) {
    // Deliberately a runtime check, not a build-time one: a missing key is a deployment
    // misconfiguration, so a visitor gets the explicit error page (app/global-error.tsx)
    // instead of silent guest mode — while a secretless build (CI) still succeeds.
    if (process.env.NODE_ENV === "production" && typeof window !== "undefined")
      throw new Error("CONFIG ERROR: Clerk publishable key missing in production.");
    console.warn("⚠ Clerk missing — dev guest mode only.");
  }

  // ClerkProvider lives in app/layout.tsx; data access is Postgres via Server Actions, so
  // there is no data provider to mount here any more.
  return <AppProvider>{children}</AppProvider>;
}
