import type { Metadata } from "next";
import TermsPage from "@/views/TermsPage";

export const metadata: Metadata = {
  title: "Terms and Conditions — ATS Hero",
  description: "What ATS Hero does and doesn’t do, what you can expect from us and what we ask of you, in plain words.",
};

export default function Terms() {
  return <TermsPage />;
}
