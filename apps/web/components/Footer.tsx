"use client";
import { useNavigate } from "@/lib/router";

export default function Footer() {
  const navigate = useNavigate();
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brand">ATS Hero</div>
          <h2 className="footer__heading">
            We’re here to make your skills visible and appreciated by recruiters
          </h2>
        </div>

        <div>
          <p className="footer__col-label">How do you want to land your next interview?</p>
          <div className="footer__actions">
            <button className="btn btn--white" onClick={() => navigate("/app/create")}>Create ATS Resume</button>
            <button className="btn btn--mint" onClick={() => navigate("/app/improve")}>Improve My Resume</button>
            <button className="btn btn--ghost-light" onClick={() => navigate("/app/jobfit")}>Check Job Fit</button>
          </div>
        </div>

        <div className="footer__trophy">
          <img src="/images/trophy.svg" alt="" aria-hidden="true" />
        </div>
      </div>
    </footer>
  );
}
