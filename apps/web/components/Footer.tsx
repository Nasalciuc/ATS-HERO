"use client";
import { useNavigate } from "@/lib/router";

export default function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="footer" data-figma="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brand" data-figma="footer-logo">
            ATS Hero
          </div>
          <h2 className="footer__heading" data-figma="footer-tagline">
            We’re here to make your skills visible and appreciated
            <br />
            by recruiters
          </h2>
        </div>

        <div>
          <p className="footer__col-label" data-figma="footer-label">How do you want to land your next interview?</p>
          <div className="footer__actions">
            <button className="btn btn--white" data-figma="footer-create" onClick={() => navigate("/app/create")}>
              Create ATS Resume
            </button>
            <button className="btn btn--mint" data-figma="footer-improve" onClick={() => navigate("/app/improve")}>
              Improve My Resume
            </button>
            <button className="btn btn--ghost-light" data-figma="footer-jobfit" onClick={() => navigate("/app/jobfit")}>
              Check Job Fit
            </button>
          </div>
        </div>

        <div className="footer__trophy" data-figma="footer-art">
          <img src="/images/trophy.svg" alt="" aria-hidden="true" />
        </div>
      </div>

      <div className="container footer__legal">
        <a href="/terms">Terms and Conditions</a>
        <a href="/privacy">Privacy Policy</a>
      </div>
    </footer>
  );
}
