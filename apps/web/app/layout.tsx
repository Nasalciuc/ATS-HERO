import "./styles.css";
import "./tailwind.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Providers from "./providers";
import { isClerkPublicConfigured } from "@/lib/clerk-config";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ATS Hero — Build, improve and match your CV to any job",
  description:
    "Create an ATS-friendly resume, get an instant ATS score, and check how well your CV matches a job description.",
  // Icons come from files Next.js finds in app/: icon.svg, favicon.ico and apple-icon.png
  // (the last two are generated from icon.svg by `npm run icons`).
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const inner = <Providers>{children}</Providers>;

  return (
    <html lang="en">
      <body id="top">
        {isClerkPublicConfigured() ? (
          <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
            signInFallbackRedirectUrl="/app"
            signUpFallbackRedirectUrl="/app"
            afterSignOutUrl="/"
            // Clerk sends SDK telemetry from development instances (the live site runs on one).
            // The privacy page lists only Google Analytics (opt-in), not this, so it is off; the CSP doesn't allow it either.
            telemetry={false}
          >
            {inner}
          </ClerkProvider>
        ) : (
          inner
        )}
      </body>
    </html>
  );
}
