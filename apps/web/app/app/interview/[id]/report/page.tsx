// Interview Trainer: a session's report. Behind the switch, like every trainer route.
import { notFound } from "next/navigation";
import { interviewTrainerEnabled } from "@/lib/features";
import ReportClient from "./ReportClient";

export default function Page() {
  if (!interviewTrainerEnabled()) notFound();
  return <ReportClient />;
}
