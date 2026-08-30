import { isClerkPublicConfigured } from "@/lib/clerk-config";
import { SsoCallbackClient } from "./sso-callback-client";

export const dynamic = "force-dynamic";

export default function SsoCallbackPage() {
  if (!isClerkPublicConfigured()) {
    return (
      <main className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
        <p>Sign-in is not configured in this environment.</p>
      </main>
    );
  }
  return <SsoCallbackClient />;
}
