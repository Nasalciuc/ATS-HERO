import type { Metadata } from "next";
import PrivacyPage from "@/views/PrivacyPage";

export const metadata: Metadata = {
  title: "Privacy Policy — ATS Hero",
  description: "What ATS Hero keeps about you, where, and for how long: step by step, in plain words.",
};

// Residency statements (AWS us-east-1, 14-day backups) are accurate from Stage B on (RDS in
// us-east-1, see infra/data.yaml). Keep them in step with the live infrastructure.
export default function Privacy() {
  return <PrivacyPage />;
}
