"use client";
import type { ReactNode } from "react";
import { ConvexProvider } from "convex/react";
import ConvexClientProvider from "@/providers/convex-clerk-provider";
import { AppProvider } from "@/store/AppContext";
import { convex } from "@/lib/convexClient";
import { isClerkPublicConfigured } from "@/lib/clerk-config";

export default function Providers({ children }: { children: ReactNode }) {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) {
    if (process.env.NODE_ENV === "production")
      throw new Error("CONFIG ERROR: Clerk publishable key missing in production.");
    console.warn("⚠ Clerk missing — dev guest mode only.");
  }

  if (!isClerkPublicConfigured()) {
    return (
      <ConvexProvider client={convex}>
        <AppProvider>{children}</AppProvider>
      </ConvexProvider>
    );
  }

  return (
    <ConvexClientProvider>
      <AppProvider>{children}</AppProvider>
    </ConvexClientProvider>
  );
}
