"use client";
import type { ReactNode } from "react";
import { AppProvider } from "@/store/AppContext";

export default function Providers({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>;
}
