import type { ReactNode } from "react";
import type { Metadata } from "next";

// Not launched yet: the blog stays out of search results until it becomes a public page. Launching
// moves /blog and /blog/[slug] from NOINDEX_ROUTES to PUBLIC_ROUTES (lib/site.ts), drops this
// robots line and updates the Privacy page in the same commit (the cookie banner runs there too).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
