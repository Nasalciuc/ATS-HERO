"use client";
import { useState } from "react";
import { Show, UserButton } from "@clerk/nextjs";
import { MenuIcon } from "./icons";
import SignInModal from "./modals/SignInModal";
import { isClerkPublicConfigured } from "@/lib/clerk-config";

function NavLogin({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="nav__login" type="button" onClick={onOpen}>
      Log in
    </button>
  );
}

export default function Navbar() {
  const [signIn, setSignIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const clerkReady = isClerkPublicConfigured();

  return (
    <header className="nav">
      <div className="container nav__inner">
        <a className="nav__logo" href="#top">
          ATS Hero
        </a>

        <button
          className="nav__menu"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon size={22} />
        </button>

        <nav className={`nav__links${menuOpen ? " is-open" : ""}`}>
          <a href="#tool" onClick={() => setMenuOpen(false)}>
            Our tool
          </a>
          <a href="#why" onClick={() => setMenuOpen(false)}>
            Why us
          </a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>
            FAQs
          </a>
        </nav>

        {clerkReady ? (
          <>
            <Show when="signed-out">
              <NavLogin onOpen={() => setSignIn(true)} />
            </Show>
            <Show when="signed-in">
              <div className="nav__account">
                <a className="nav__login" href="/app">
                  My CVs
                </a>
                <UserButton />
              </div>
            </Show>
          </>
        ) : (
          <NavLogin onOpen={() => setSignIn(true)} />
        )}
      </div>
      <SignInModal open={signIn} onClose={() => setSignIn(false)} />
    </header>
  );
}
