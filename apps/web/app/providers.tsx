"use client";
import type { ReactNode } from "react";
import ConvexClientProvider from "@/providers/convex-clerk-provider";
import { AppProvider } from "@/store/AppContext";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <AppProvider>{children}</AppProvider>
    </ConvexClientProvider>
  );
}
