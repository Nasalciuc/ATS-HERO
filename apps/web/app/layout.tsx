import "./styles.css";
import "./tailwind.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Providers from "./providers";
import { isClerkPublicConfigured } from "@/lib/clerk-config";

export const metadata: Metadata = {
  title: "ATS Hero — Build, improve and match your CV to any job",
  description:
    "Create an ATS-friendly resume, get an instant ATS score, and check how well your CV matches a job description.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const body = (
    <html lang="en">
      <body id="top">
        <Providers>{children}</Providers>
      </body>
    </html>
  );

  if (!isClerkPublicConfigured()) {
    return body;
  }

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      {body}
    </ClerkProvider>
  );
}
