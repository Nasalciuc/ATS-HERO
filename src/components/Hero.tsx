import { useNavigate } from "react-router-dom";
import { StatCv, StatScan, StatGraph, FileDownload } from "./icons";
import HeroResume from "./HeroResume";

const stats = [
  { Icon: StatCv, num: "75% of resumes", desc: "are filtered by ATS first before review" },
  { Icon: StatScan, num: "1 fast scan", desc: "can reveal what’s blocking your resume" },
  { Icon: StatGraph, num: "2–3× more likely", desc: "to land interviews with ATS optimization" },
];

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="hero" id="top">
      <div className="container hero__grid">
        <div className="hero__left">
          <span className="hero__badge">
            <span className="hero__badge-dot" />
            Get the message every candidate wants:
          </span>

          <h1 className="hero__title">
            <span className="hero__title-mark">
              You’re exactly who<br />we’re looking for
            </span>
          </h1>

          <p className="hero__lead">
            Not getting interviews despite your experience? Our tool will help
            yout to turn your experience into a job-winning asset.
          </p>

          <div className="hero__cta">
            <button className="btn btn--dark" onClick={() => navigate("/app/create")}>Create ATS Resume</button>
            <button className="btn btn--outline-dark" onClick={() => navigate("/app/improve")}>Improve My Resume</button>
          </div>

          <div className="hero__stats">
            {stats.map(({ Icon, num, desc }) => (
              <div className="stat" key={num}>
                <div className="stat__icon">
                  <Icon />
                </div>
                <div className="stat__num">{num}</div>
                <div className="stat__desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero__art">
          <div className="hero__stage">
            <div className="hero__cv">
              <HeroResume />
            </div>

            <div className="badge-card badge-100">
              <div className="ring100">
                <span>100%</span>
              </div>
              <div className="badge-100__label">ATS-Friendly</div>
            </div>

            <div className="badge-card badge-pdf">
              <FileDownload />
              <div className="badge-pdf__label">PDF / DOC</div>
            </div>

            <div className="badge-pill">*Based on hiring best practices</div>
            <img className="hero__deco" src="/images/hero-deco.svg" alt="" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
