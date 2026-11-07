// Interview Trainer: set up a practice for one job (?job=<id>). Behind the switch, like every trainer route.
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { interviewTrainerEnabled } from "@/lib/features";
import SetupClient from "./SetupClient";

export default function Page() {
  if (!interviewTrainerEnabled()) notFound();
  // the job comes from the address (useSearchParams), which waits for the browser
  return (
    <Suspense fallback={null}>
      <SetupClient />
    </Suspense>
  );
}
