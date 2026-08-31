"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRef, useState } from "react";
import { isClerkPublicConfigured } from "@/lib/clerk-config";
import Modal from "../ui/Modal";
import { GitHubIcon, GoogleIcon } from "../icons";

type Phase = "email" | "code";
type Flow = "sign-in" | "sign-up";
type OAuthStrategy = "oauth_google" | "oauth_github";

function clerkMessage(error: { message?: string; longMessage?: string } | null | undefined, fallback: string) {
  return error?.longMessage || error?.message || fallback;
}

function isIdentifierNotFound(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const message = error.message ?? "";
  return (
    code === "form_identifier_not_found" ||
    code === "identifier_not_found" ||
    /not found|couldn't find|could not find|no account/i.test(message)
  );
}

function isPasswordMissing(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const blob = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return blob.includes("password");
}

function isStaleSignIn(error: { code?: string; message?: string; longMessage?: string } | null | undefined): boolean {
  if (!error) return false;
  const blob = `${error.code ?? ""} ${error.message ?? ""} ${error.longMessage ?? ""}`.toLowerCase();
  return (
    blob.includes("older sign in") ||
    blob.includes("older sign-in") ||
    error.code === "sign_in_outdated" ||
    error.code === "resource_outdated"
  );
}

function hiddenSignupPassword(): string {
  const rand = crypto.randomUUID().replace(/-/g, "");
  return `Ah1!${rand}`;
}

function OtpBoxes({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const focusAt = (index: number) => {
    const el = refs.current[Math.max(0, Math.min(5, index))];
    el?.focus();
    el?.select();
  };

  const apply = (next: string, focusIndex: number) => {
    const cleaned = next.replace(/\D/g, "").slice(0, 6);
    onChange(cleaned);
    focusAt(focusIndex);
  };

  return (
    <div className="signin__otp" role="group" aria-label="Verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="signin__otp-cell"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={i === 0}
          onChange={(e) => {
            const incoming = e.target.value.replace(/\D/g, "");
            if (incoming.length > 1) {
              apply(incoming, incoming.length >= 6 ? 5 : incoming.length);
              return;
            }
            const next = `${value.slice(0, i)}${incoming}${value.slice(i + 1)}`;
            apply(next, incoming ? i + 1 : i);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (digits[i]) {
                apply(`${value.slice(0, i)}${value.slice(i + 1)}`, i);
              } else {
                apply(value.slice(0, i - 1), i - 1);
              }
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              focusAt(i - 1);
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              focusAt(i + 1);
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (!pasted) return;
            e.preventDefault();
            apply(pasted, pasted.length >= 6 ? 5 : pasted.length);
          }}
        />
      ))}
    </div>
  );
}

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
  const { signIn, errors: signInErrors, fetchStatus: signInStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpStatus } = useSignUp();
  const [phase, setPhase] = useState<Phase>("email");
  const [flow, setFlow] = useState<Flow>("sign-in");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const verifyingRef = useRef(false);

  const busy = signInStatus === "fetching" || signUpStatus === "fetching";
  const rawFieldError =
    phase === "email"
      ? signInErrors?.fields?.identifier?.message || signUpErrors?.fields?.emailAddress?.message
      : flow === "sign-up"
        ? signUpErrors?.fields?.code?.message
        : signInErrors?.fields?.code?.message;
  const fieldError = isStaleSignIn({ message: rawFieldError ?? undefined }) ? null : rawFieldError;
  const shownError = error || fieldError || null;

  const resetResources = () => {
    try {
      signIn.reset();
    } catch {
      /* ignore */
    }
    try {
      signUp.reset();
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    verifyingRef.current = false;
    setPhase("email");
    setFlow("sign-in");
    setEmail("");
    setCode("");
    setError(null);
    resetResources();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const activate = async (kind: Flow) => {
    const resource = kind === "sign-up" ? signUp : signIn;
    await resource.finalize({
      navigate: async ({ decorateUrl }) => {
        handleClose();
        const url = decorateUrl("/app");
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          window.location.assign(url);
        }
      },
    });
  };

  const ensureSignupPassword = async (): Promise<boolean> => {
    const missing = signUp.missingFields ?? [];
    if (signUp.status === "complete" || !missing.includes("password")) return true;
    const { error: pwError } = await signUp.password({
      emailAddress: email,
      password: hiddenSignupPassword(),
    });
    if (pwError) {
      setError(clerkMessage(pwError, "Could not complete email sign-up"));
      return false;
    }
    return true;
  };

  const signInWithOAuth = async (strategy: OAuthStrategy) => {
    setError(null);
    const { error: signInError } = await signIn.sso({
      strategy,
      redirectUrl: "/app",
      redirectCallbackUrl: "/sso-callback",
    });
    if (!signInError) return;

    const { error: signUpError } = await signUp.sso({
      strategy,
      redirectUrl: "/app",
      redirectCallbackUrl: "/sso-callback",
    });
    if (signUpError) {
      setError(clerkMessage(signUpError, clerkMessage(signInError, "OAuth sign-in failed")));
    }
  };

  const startSignupWithEmail = async (): Promise<boolean> => {
    const created = await signUp.create({ emailAddress: email });
    if (created.error) {
      if (!isPasswordMissing(created.error)) {
        setError(clerkMessage(created.error, "Could not start email sign-up"));
        return false;
      }
      const pw = await signUp.password({
        emailAddress: email,
        password: hiddenSignupPassword(),
      });
      if (pw.error) {
        setError(clerkMessage(pw.error, "Could not start email sign-up"));
        return false;
      }
    } else if (!(await ensureSignupPassword())) {
      return false;
    }

    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setError(clerkMessage(sent.error, "Could not send verification code"));
      return false;
    }
    setFlow("sign-up");
    setPhase("code");
    return true;
  };

  const sendEmailCode = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }

    resetResources();
    const { error: sendError } = await signIn.emailCode.sendCode({ emailAddress: email });
    if (!sendError) {
      setFlow("sign-in");
      setPhase("code");
      setCode("");
      return;
    }

    if (!isIdentifierNotFound(sendError) && !isStaleSignIn(sendError)) {
      setError(clerkMessage(sendError, "Email sign-in failed"));
      return;
    }

    resetResources();
    await startSignupWithEmail();
  };

  const resendCode = async () => {
    setError(null);
    setCode("");
    verifyingRef.current = false;

    if (flow === "sign-up") {
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) {
        setError(clerkMessage(sent.error, "Could not resend the code"));
      }
      return;
    }

    const sent = await signIn.emailCode.sendCode();
    if (!sent.error) return;

    if (isStaleSignIn(sent.error)) {
      resetResources();
      const retry = await signIn.emailCode.sendCode({ emailAddress: email });
      if (retry.error) setError(clerkMessage(retry.error, "Could not resend the code"));
      return;
    }

    setError(clerkMessage(sent.error, "Could not resend the code"));
  };

  const verifyEmailCode = async (raw?: string) => {
    if (verifyingRef.current) return;
    const value = (raw ?? code).replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(value)) {
      setError("Enter the 6-digit code from your email");
      return;
    }

    verifyingRef.current = true;
    setError(null);
    try {
      if (flow === "sign-up") {
        const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: value });
        if (verifyError) {
          setError(clerkMessage(verifyError, "Verification failed"));
          return;
        }
        if (!(await ensureSignupPassword())) return;
        if (signUp.status !== "complete") {
          setError("Sign-up is not complete yet. Try Google or GitHub, or request a new code.");
          return;
        }
        await activate("sign-up");
        return;
      }

      const { error: verifyError } = await signIn.emailCode.verifyCode({ code: value });
      if (verifyError) {
        if (isStaleSignIn(verifyError)) {
          setCode("");
          const resent = await signIn.emailCode.sendCode();
          if (resent.error) {
            resetResources();
            await signIn.emailCode.sendCode({ emailAddress: email });
          }
          setError("This code expired. We sent a new one — enter it below.");
          return;
        }
        setError(clerkMessage(verifyError, "Verification failed"));
        return;
      }
      if (signIn.status !== "complete") {
        setError("Sign-in is not complete yet. Try again.");
        return;
      }
      await activate("sign-in");
    } finally {
      verifyingRef.current = false;
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
        <h2 className={`signin__title${phase === "code" ? " signin__title--code" : ""}`}>
          {phase === "email" ? "Enter your e-mail" : "Check your e-mail"}
        </h2>

        <div className="signin__body">
          {phase === "email" ? (
            <>
              <div className="signin__email-block">
                <div className="signin__field">
                  <label className="signin__label" htmlFor="signin-email">
                    E-mail address
                  </label>
                  <input
                    id="signin-email"
                    className="signin__input"
                    type="email"
                    value={email}
                    autoFocus
                    disabled={busy}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void sendEmailCode()}
                  />
                </div>

                {shownError && <p className="signin__error">{shownError}</p>}

                <div className="signin__next-row">
                  <button
                    className="signin__next"
                    type="button"
                    onClick={() => void sendEmailCode()}
                    disabled={busy}
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
                    disabled={busy}
                  >
                    <GoogleIcon size={24} />
                    Continue with Google
                  </button>
                  <button
                    className="signin__provider"
                    type="button"
                    onClick={() => void signInWithOAuth("oauth_github")}
                    disabled={busy}
                  >
                    <GitHubIcon size={24} />
                    Continue with GitHub
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="signin__code-block">
              <p className="signin__hint">
                We sent a 6-digit code to <strong>{email}</strong>
              </p>
              <div className="signin__field">
                <span className="signin__label" id="signin-otp-label">
                  Verification code
                </span>
                <OtpBoxes
                  value={code}
                  disabled={busy}
                  onChange={(next) => {
                    setCode(next);
                    setError(null);
                    if (next.length === 6) void verifyEmailCode(next);
                  }}
                />
              </div>

              {shownError && <p className="signin__error">{shownError}</p>}

              <div className="signin__actions">
                <button
                  className="signin__back"
                  type="button"
                  onClick={() => {
                    verifyingRef.current = false;
                    setPhase("email");
                    setCode("");
                    setError(null);
                    resetResources();
                  }}
                  disabled={busy}
                >
                  Back
                </button>
                <button
                  className="signin__next signin__next--fill"
                  type="button"
                  onClick={() => void verifyEmailCode()}
                  disabled={busy || code.length !== 6}
                >
                  {busy ? "…" : "Verify"}
                </button>
              </div>

              <button
                className="signin__resend"
                type="button"
                onClick={() => void resendCode()}
                disabled={busy}
              >
                Resend code
              </button>
            </div>
          )}

          {phase === "email" ? <div id="clerk-captcha" /> : null}

          <p className="signin__terms">
            By continuing, you agree to our{" "}
            <a href="/terms" target="_blank" rel="noreferrer">Terms and Conditions</a> and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
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
