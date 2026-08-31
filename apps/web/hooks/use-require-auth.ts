"use client";
import { useAuth } from "@clerk/nextjs";

/**
 * Wraps a Tier 2/3 handler so it only runs for signed-in users; otherwise the sign-in modal
 * opens. Keeps the gate in one place instead of scattering `isSignedIn` checks in the views.
 */
export function useRequireAuth(openSignIn: () => void) {
  const { isSignedIn } = useAuth();
  return function gated<T extends (...a: never[]) => unknown>(fn: T) {
    return ((...a: Parameters<T>) => (isSignedIn ? fn(...a) : openSignIn())) as T;
  };
}
