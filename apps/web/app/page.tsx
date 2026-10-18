import type { Metadata } from "next";
import LandingPage from "@/views/LandingPage";
import JsonLd from "@/components/JsonLd";
import { homeJsonLd } from "@/lib/structured-data";

// The home page's own title and description: what people ask search and AI assistants for.
// "Free" is what the Terms say during the beta; change it with the Terms.
export const metadata: Metadata = {
  title: "ATS Hero — Free ATS resume checker and CV builder",
  description:
    "Check your resume's ATS score for free, see what a tracking system reads, and match your CV to a job description. No account needed.",
  alternates: { canonical: "/" },
};

export default function Page() {
  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <LandingPage />
    </>
  );
}
