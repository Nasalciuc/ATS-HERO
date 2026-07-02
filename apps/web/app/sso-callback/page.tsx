import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/** Finishes OAuth started from our custom SignInModal. */
export default function SsoCallbackPage() {
  return (
    <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
      <p>Finishing sign-in…</p>
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/app" signUpFallbackRedirectUrl="/app" />
    </div>
  );
}
