"use client";
import useSWR from "swr";
import { getMySubscription } from "@/app/actions/subscriptions";

const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

/**
 * Subscription state for the signed-in user. With billing disabled nothing is fetched and
 * `isPaid` is false, so the UI never depends on Paddle until the flag flips.
 */
export function useSubscription() {
  const { data } = useSWR(BILLING_ENABLED ? ["subscription"] : null, () => getMySubscription());
  const status = data?.status;
  return {
    enabled: BILLING_ENABLED,
    subscription: data ?? null,
    isPaid: status === "active" || status === "trialing",
  };
}
