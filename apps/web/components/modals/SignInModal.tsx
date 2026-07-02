"use client";

import { useSignIn } from "@clerk/nextjs/legacy";
import type { OAuthStrategy } from "@clerk/nextjs/types";
import { useState } from "react";
import { isClerkPublicConfigured } from "@/lib/clerk-config";
import Modal from "../ui/Modal";
import { GitHubIcon, GoogleIcon } from "../icons";

type Phase = "email" | "code";

function SignInModalUnavailable({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} variant="side" width={690} overlayClassName="modal--signin-overlay" panelClassName="modal__panel--signin">
      <div className="signin">
        <h2 className="signin__title">Sign-in unavailable</h2>
        <p className="signin__hint" style={{ marginTop: "1rem" }}>
          Authentication is not configured on this deployment. You can still build CVs and run ATS scoring as a guest.
        </p>
      </div>
    </Modal>
  );
}

function SignInModalClerk({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPhase("email");
    setEmail("");
    setCode("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const signInWithOAuth = async (strategy: OAuthStrategy) => {
    if (!isLoaded) return;
    setError(null);
    setBusy(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: window.location.pathname || "/app",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "OAuth sign-in failed");
      setBusy(false);
    }
  };

  const sendEmailCode = async () => {
    if (!isLoaded) return;
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      await signIn.create({ identifier: email });

      const emailCodeFactor = signIn.supportedFirstFactors?.find((f) => f.strategy === "email_code");
      if (!emailCodeFactor || emailCodeFactor.strategy !== "email_code") {
        setError("Email code sign-in is not enabled in Clerk. Use Google or GitHub.");
        return;
      }

      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: emailCodeFactor.emailAddressId,
      });

      setPhase("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Email sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyEmailCode = async () => {
    if (!isLoaded) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your email");
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        handleClose();
        return;
      }

      setError("Sign-in is not complete yet. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      variant="side"
      width={690}
      overlayClassName="modal--signin-overlay"
      panelClassName="modal__panel--signin"
    >
      <div className="signin">
        <h2 className="signin__title">
          {phase === "email" ? "Enter your e-mail" : "Check your e-mail"}
        </h2>

        <div className="signin__body">
          {phase === "email" ? (
            <>
              <div className="signin__email-block">
                <div className="signin__field">
                  <label className="signin__label" htmlFor="signin-email">
                    E-mail adress
                  </label>
                  <input
                    id="signin-email"
                    className="signin__input"
                    type="email"
                    value={email}
                    autoFocus
                    disabled={!isLoaded || busy}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void sendEmailCode()}
                  />
                </div>

                {error && <p className="signin__error">{error}</p>}

                <div className="signin__next-row">
                  <button
                    className="signin__next"
                    type="button"
                    onClick={() => void sendEmailCode()}
                    disabled={!isLoaded || busy}
                  >
                    {busy ? "…" : "Next"}
                  </button>
                </div>
              </div>

              <div className="signin__social-block">
                <div className="signin__divider">
                  <span>or</span>
                </div>

                <div className="signin__providers">
                  <button
                    className="signin__provider"
                    type="button"
                    onClick={() => void signInWithOAuth("oauth_google")}
                    disabled={!isLoaded || busy}
                  >
                    <GoogleIcon size={24} />
                    Continue with Google
                  </button>
                  <button
                    className="signin__provider"
                    type="button"
                    onClick={() => void signInWithOAuth("oauth_github")}
                    disabled={!isLoaded || busy}
                  >
                    <GitHubIcon size={24} />
                    Continue with GitHub
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="signin__email-block">
              <p className="signin__hint" style={{ marginBottom: "1rem" }}>
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
              <div className="signin__field">
                <label className="signin__label" htmlFor="signin-code">
                  Verification code
                </label>
                <input
                  id="signin-code"
                  className="signin__input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  autoFocus
                  disabled={!isLoaded || busy}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && void verifyEmailCode()}
                />
              </div>

              {error && <p className="signin__error">{error}</p>}

              <div className="signin__next-row" style={{ gap: "0.75rem" }}>
                <button
                  className="signin__provider"
                  type="button"
                  onClick={() => {
                    setPhase("email");
                    setCode("");
                    setError(null);
                  }}
                  disabled={busy}
                >
                  Back
                </button>
                <button
                  className="signin__next"
                  type="button"
                  onClick={() => void verifyEmailCode()}
                  disabled={!isLoaded || busy}
                >
                  {busy ? "…" : "Verify"}
                </button>
              </div>
            </div>
          )}

          <p className="signin__terms">
            By continuing, you agree to our <a href="#">Terms and Conditions</a> and{" "}
            <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default function SignInModal(props: { open: boolean; onClose: () => void }) {
  if (!isClerkPublicConfigured()) {
    return <SignInModalUnavailable {...props} />;
  }
  return <SignInModalClerk {...props} />;
}
