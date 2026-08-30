"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/** Finishes Google / GitHub OAuth started from the custom SignInModal. */
export default function SsoCallbackPage() {
  return (
    <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
      <p>Finishing sign-in…</p>
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/app" signUpFallbackRedirectUrl="/app" />
    </div>
  );
}
