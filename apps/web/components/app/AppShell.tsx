"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useNavigate } from "@/lib/router";
import { useApp } from "../../store/AppContext";
import { useCvs } from "@/hooks/use-cvs";
import { MenuIcon } from "../icons";
import { ChevronUp, UserOutline } from "../figma-icons";
import SignInModal from "../modals/SignInModal";
import { FeedbackLink } from "./FeedbackLink";

type NavKey = "cvs" | "create" | "improve" | "jobfit" | "tracker";

type NavItem = { key: NavKey; label: string; to: string; count?: number };

/** Phones: the short section name in the top bar (Figma mobile "Create CV"). */
const SECTION: Record<NavKey, string> = {
  create: "Create CV",
  improve: "Improve CV",
  jobfit: "Job Fit",
  tracker: "Tracker",
  cvs: "My Resumes",
};

/**
 * Figma "Menu": Create / Improve / Check Job Fit, then "My Resumes (n)" once there is a CV to go
 * back to (the Figma variant with a count). Tracker is ours (not in Figma) and needs an account,
 * so a guest never sees it. The only other addition is the small Feedback link at the bottom.
 */
function navItems(cvCount: number, signedIn: boolean, active: NavKey): NavItem[] {
  const items: NavItem[] = [
    { key: "create", label: "Create ATS Resume", to: "/app/create" },
    { key: "improve", label: "Improve My Resume", to: "/app/improve" },
    { key: "jobfit", label: "Check Job Fit", to: "/app/jobfit" },
  ];
  if (cvCount > 0 || active === "cvs") items.push({ key: "cvs", label: "My Resumes", to: "/app", count: cvCount });
  if (signedIn || active === "tracker") items.push({ key: "tracker", label: "Tracker", to: "/app/tracker" });
  return items;
}

export default function AppShell({
  title,
  active,
  actions,
  children,
  section,
  onBack,
  phoneTitle,
}: {
  title: string;
  /** phones: a shorter page title when the Figma mobile frame has one ("Work experience") */
  phoneTitle?: string;
  active: NavKey;
  actions?: ReactNode;
  children: ReactNode;
  /** phones: the label centred in the top bar (defaults to the section of `active`) */
  section?: string;
  /** phones: what "‹ Back" does (defaults to the home screen, /app) */
  onBack?: () => void;
}) {
  const { user, logout } = useApp();
  const cvs = useCvs();
  const nav = navItems(cvs?.length ?? 0, Boolean(user), active);
  const [signIn, setSignIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  // The drawer (under 1024px) closes on Escape like any overlay.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="appshell">
      {menuOpen && <button className="appshell__backdrop" aria-label="Close menu" onClick={closeMenu} />}

      <aside id="app-menu" className={`appshell__side${menuOpen ? " is-open" : ""}`} data-figma="sidebar">
        <Link href="/" className="appshell__logo" data-figma="logo" onClick={closeMenu}>
          ATS Hero
        </Link>

        <nav className="appshell__nav">
          {nav.map((n, i) => (
            <Fragment key={n.key}>
              <span className="appshell__sep" data-figma={`nav-sep-${i}`} aria-hidden="true" />
              <Link
                href={n.to}
                className={`appshell__nav-item${active === n.key ? " is-active" : ""}`}
                aria-current={active === n.key ? "page" : undefined}
                data-figma={`nav-${n.key}`}
                onClick={closeMenu}
              >
                {active === n.key && <span className="appshell__dot" data-figma="nav-dot" />}
                <span>
                  {n.label}
                  {n.count !== undefined && n.count > 0 && <span className="appshell__count"> ({n.count})</span>}
                </span>
              </Link>
            </Fragment>
          ))}
          <span className="appshell__sep" data-figma={`nav-sep-${nav.length}`} aria-hidden="true" />
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
                {/* ep:user cropped to its glyph: Figma's 15.72×18 vector */}
                <UserOutline width={15.43} height={18} viewBox="128 64 768 896" /> Sign in
              </button>
            </>
          )}
          <FeedbackLink />
        </div>
      </aside>

      <div className="appshell__main">
        <header className="appshell__topbar" data-figma="title-panel">
          <button
            className="appshell__menu"
            type="button"
            aria-label="Open menu"
            aria-controls="app-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon size={22} />
          </button>
          {/* Phones (Figma mobile page 17:1152): "‹ Back · Create CV" on top, the page title under it.
              Both are hidden above 720px, where the sidebar / drawer does the navigation. */}
          <button type="button" className="appshell__back" data-figma="m-back" onClick={onBack ?? (() => navigate("/app"))}>
            <ChevronUp width={16} height={16} className="appshell__back-icon" />
            <span data-figma="m-back-label">Back</span>
          </button>
          <span className="appshell__section" data-figma="m-section" aria-hidden="true">
            {section ?? SECTION[active]}
          </span>
          {/* tabIndex -1: the builder moves focus here when the step changes */}
          <h1 className="appshell__title" data-figma="title" tabIndex={-1}>
            {phoneTitle && phoneTitle !== title ? (
              <>
                <span className="appshell__title-wide">{title}</span>
                <span className="appshell__title-phone">{phoneTitle}</span>
              </>
            ) : (
              title
            )}
          </h1>
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
