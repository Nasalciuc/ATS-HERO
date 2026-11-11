// Interview Trainer home. Behind NEXT_PUBLIC_INTERVIEW_TRAINER_ENABLED (AGENTS.md rule 12): while it
// is off the route doesn't exist. The data and the handlers are in HomeClient.
import { notFound } from "next/navigation";
import { interviewTrainerEnabled } from "@/lib/features";
import HomeClient from "./HomeClient";

export default function Page() {
  if (!interviewTrainerEnabled()) notFound();
  return <HomeClient />;
}
