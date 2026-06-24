import "./styles.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ATS Hero — Build, improve and match your CV to any job",
  description:
    "Create an ATS-friendly resume, get an instant ATS score, and check how well your CV matches a job description.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body id="top">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
