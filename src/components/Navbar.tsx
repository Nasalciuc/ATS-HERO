import { useState } from "react";
import SignInModal from "./modals/SignInModal";

export default function Navbar() {
  const [signIn, setSignIn] = useState(false);
  return (
    <header className="nav">
      <div className="container nav__inner">
        <a className="nav__logo" href="#top">
          ATS Hero
        </a>
        <nav className="nav__links">
          <a href="#tool">Our tool</a>
          <a href="#why">Why us</a>
          <a href="#faq">FAQs</a>
        </nav>
        <button className="nav__login" onClick={() => setSignIn(true)}>Log in</button>
      </div>
      <SignInModal open={signIn} onClose={() => setSignIn(false)} />
    </header>
  );
}
