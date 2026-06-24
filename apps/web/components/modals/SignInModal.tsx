"use client";
import { useState } from "react";
import Modal from "../ui/Modal";
import { AppleIcon, GoogleIcon } from "../icons";
import { useApp } from "../../store/AppContext";

export default function SignInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmail("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    setBusy(true);
    try {
      await login(email);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
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
        <h2 className="signin__title">Enter your e-mail</h2>

        <div className="signin__body">
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
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>

            {error && <p className="signin__error">{error}</p>}

            <div className="signin__next-row">
              <button className="signin__next" type="button" onClick={submit} disabled={busy}>
                {busy ? "…" : "Next"}
              </button>
            </div>
          </div>

          <div className="signin__social-block">
            <div className="signin__divider">
              <span>or</span>
            </div>

            <div className="signin__providers">
              <button className="signin__provider" type="button" onClick={submit} disabled={busy}>
                <GoogleIcon size={24} />
                Continue with Google
              </button>
              <button className="signin__provider" type="button" onClick={submit} disabled={busy}>
                <AppleIcon size={24} />
                Continue with Apple
              </button>
            </div>

            <p className="signin__terms">
              By continuing, you agree to our <a href="#">Terms and Conditions</a> and{" "}
              <a href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
