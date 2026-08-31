"use client";
import { useAuth } from "@clerk/nextjs";
import { isClerkPublicConfigured } from "@/lib/clerk-config";

function useClerkUserId(): string | null {
  const { userId } = useAuth();
  return userId ?? null;
}

export function useCurrentUserId(): string | null {
  // Build-time constant → the branch never flips at runtime; safe with the rules of hooks.
  if (!isClerkPublicConfigured()) return null;
  return useClerkUserId();
}
