import { useState } from "react";
import Modal from "../ui/Modal";
import { useApp } from "../../store/AppContext";

export default function SignInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
    setStep("email");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (step === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Enter a valid email address");
        return;
      }
      setStep("password");
      return;
    }
    setBusy(true);
    try {
      await login(email, password || undefined);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} variant="side">
      <div className="signin">
        <h2 className="signin__title">Enter your e-mail</h2>

        <label className="signin__label">E-mail adress</label>
        <input
          className="signin__input"
          type="email"
          value={email}
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {step === "password" && (
          <>
            <label className="signin__label">Password (optional)</label>
            <input
              className="signin__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </>
        )}

        {error && <p className="signin__error">{error}</p>}

        <div className="signin__next-row">
          <button className="signin__next" onClick={submit} disabled={busy}>
            {busy ? "…" : "Next"}
          </button>
        </div>

        <div className="signin__divider"><span>or</span></div>

        <button className="signin__provider" onClick={submit} disabled={busy}>
          <span className="signin__g">G</span> Continue with Google
        </button>
        <button className="signin__provider" onClick={submit} disabled={busy}>
          <span aria-hidden></span> Continue with Apple
        </button>

        <p className="signin__terms">
          By continuing, you agree to our <a href="#">Terms and Conditions</a> and{" "}
          <a href="#">Privacy Policy</a>.
        </p>
      </div>
    </Modal>
  );
}
