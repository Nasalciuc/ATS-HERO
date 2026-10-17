import type { Metadata } from "next";
import CreditsPage from "@/views/CreditsPage";

export const metadata: Metadata = {
  title: "Credits — ATS Hero",
  description: "The icons, the font and the open-source software ATS Hero is built with, and their licences.",
};

export default function Credits() {
  return <CreditsPage />;
}
