// Metadata only: every route under /app is the application (a guest's or a user's CVs) and must
// not be indexed. This layout renders no DOM on purpose: the design check measures these screens,
// and a wrapper here would move every box. Keep it that way.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
