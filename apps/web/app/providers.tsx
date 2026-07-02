"use client";
import type { ReactNode } from "react";
import { ConvexProvider } from "convex/react";
import ConvexClientProvider from "@/providers/convex-clerk-provider";
import { AppProvider } from "@/store/AppContext";
import { convex } from "@/lib/convexClient";
import { isClerkPublicConfigured } from "@/lib/clerk-config";

export default function Providers({ children }: { children: ReactNode }) {
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
