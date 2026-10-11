"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useNavigate } from "@/lib/router";
import { useApp } from "../../store/AppContext";
import { MenuIcon, UserIcon } from "../icons";
import SignInModal from "../modals/SignInModal";
import { FeedbackLink } from "./FeedbackLink";

type NavKey = "cvs" | "create" | "improve" | "jobfit" | "tracker";

const NAV: { key: NavKey; label: string; to: string }[] = [
  // The dashboard is "home" (PAGES-DESIGN-SPEC §2). Without this entry the builder had no
  // in-app way back to the CV list — so no way to start a second CV or switch between CVs.
  { key: "cvs", label: "Your CVs", to: "/app" },
  { key: "create", label: "Create ATS Resume", to: "/app/create" },
  { key: "improve", label: "Improve My Resume", to: "/app/improve" },
  { key: "jobfit", label: "Check Job Fit", to: "/app/jobfit" },
  { key: "tracker", label: "Tracker", to: "/app/tracker" },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="appshell">
      {menuOpen && <button className="appshell__backdrop" aria-label="Close menu" onClick={closeMenu} />}

      <aside className={`appshell__side${menuOpen ? " is-open" : ""}`} data-figma="sidebar">
        <Link href="/" className="appshell__logo" data-figma="logo" onClick={closeMenu}>
          ATS Hero
        </Link>

        <nav className="appshell__nav">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.to}
              className={`appshell__nav-item${active === n.key ? " is-active" : ""}`}
              data-figma={`nav-${n.key}`}
              onClick={closeMenu}
            >
              {active === n.key && <span className="appshell__dot" data-figma="nav-dot" />}
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="appshell__side-footer">
          {user ? (
            <>
              <p className="appshell__hint">
                Signed in as
                <br />
                {user.email}
              </p>
              <button className="appshell__signin" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <p className="appshell__hint" data-figma="signin-hint">Sign in to save your progress and continue editing anytime</p>
              <button
                className="appshell__signin"
                data-figma="signin"
                onClick={() => {
                  closeMenu();
                  setSignIn(true);
                }}
              >
                <UserIcon size={16} /> Sign in
              </button>
            </>
          )}
          <FeedbackLink />
        </div>
      </aside>

      <div className="appshell__main">
        <header className="appshell__topbar" data-figma="title-panel">
          <button className="appshell__menu" type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon size={22} />
          </button>
          <h1 className="appshell__title" data-figma="title">{title}</h1>
          <div className="appshell__actions">{actions}</div>
        </header>
        <div className="appshell__content">{children}</div>
      </div>

      <SignInModal
        open={signIn}
        onClose={() => {
          setSignIn(false);
          navigate(0);
        }}
      />
    </div>
  );
}
