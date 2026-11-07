// Interview Trainer: the session itself, full screen. Behind the switch, like every trainer route.
import { notFound } from "next/navigation";
import { interviewTrainerEnabled } from "@/lib/features";
import LiveClient from "./LiveClient";

export default function Page() {
  if (!interviewTrainerEnabled()) notFound();
  return <LiveClient />;
}
