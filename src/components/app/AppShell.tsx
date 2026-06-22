import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../store/AppContext";
import { UserIcon } from "../icons";
import SignInModal from "../modals/SignInModal";

type NavKey = "create" | "improve" | "jobfit";

const NAV: { key: NavKey; label: string; to: string }[] = [
  { key: "create", label: "Create ATS Resume", to: "/app/create" },
  { key: "improve", label: "Improve My Resume", to: "/app/improve" },
  { key: "jobfit", label: "Check Job Fit", to: "/app/jobfit" },
];

export default function AppShell({
  title,
  active,
  actions,
  children,
}: {
  title: string;
  active: NavKey;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useApp();
  const [signIn, setSignIn] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="appshell">
      <aside className="appshell__side">
        <Link to="/" className="appshell__logo">ATS Hero</Link>

        <nav className="appshell__nav">
          {NAV.map((n) => (
            <Link
              key={n.key}
              to={n.to}
              className={`appshell__nav-item${active === n.key ? " is-active" : ""}`}
            >
              {active === n.key && <span className="appshell__dot" />}
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="appshell__side-footer">
          {user ? (
            <>
              <p className="appshell__hint">Signed in as<br />{user.email}</p>
              <button className="appshell__signin" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <p className="appshell__hint">Sign in to save your progress and continue editing anytime</p>
              <button className="appshell__signin" onClick={() => setSignIn(true)}>
                <UserIcon size={16} /> Sign in
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="appshell__main">
        <header className="appshell__topbar">
          <h1 className="appshell__title">{title}</h1>
          <div className="appshell__actions">{actions}</div>
        </header>
        <div className="appshell__content">{children}</div>
      </div>

      <SignInModal open={signIn} onClose={() => { setSignIn(false); navigate(0); }} />
    </div>
  );
}
