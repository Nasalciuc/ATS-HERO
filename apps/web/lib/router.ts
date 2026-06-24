"use client";
import { useRouter } from "next/navigation";

/**
 * Drop-in replacement for react-router-dom's useNavigate during the Next.js port.
 * - navigate("/path") → router.push
 * - navigate(0)        → router.refresh (react-router used numeric deltas)
 */
export function useNavigate() {
  const router = useRouter();
  return (to: string | number) => {
    if (typeof to === "number") {
      router.refresh();
      return;
    }
    router.push(to);
  };
}
