import { useState } from "react";
import { MenuIcon } from "./icons";
import SignInModal from "./modals/SignInModal";

export default function Navbar() {
  const [signIn, setSignIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

        <button className="nav__login" onClick={() => setSignIn(true)}>
          Log in
        </button>
      </div>
      <SignInModal open={signIn} onClose={() => setSignIn(false)} />
    </header>
  );
}
