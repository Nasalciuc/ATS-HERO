import type { Metadata } from "next";
import LandingPage from "@/views/LandingPage";
import JsonLd from "@/components/JsonLd";
import { homeJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <LandingPage />
    </>
  );
}
