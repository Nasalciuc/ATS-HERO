"use client";
import { Fragment } from "react";
import { useNavigate } from "@/lib/router";
import { CvFileIcon, FileDownloadIcon, GraphBarIcon, ScanIcon } from "./figma-icons";

const stats = [
  { Icon: CvFileIcon, size: 32, num: "75% of resumes", desc: "are filtered by ATS first before review" },
  { Icon: ScanIcon, size: 32, num: "1 fast scan", desc: "can reveal what’s blocking your resume" },
  { Icon: GraphBarIcon, size: 27, num: "2–3× more likely", desc: "to land interviews with ATS optimization" },
];

function TitleBracketTL() {
  return (
    <svg className="hero__title-bracket hero__title-bracket--tl" width="7" height="68" viewBox="0 0 7 68" fill="none" aria-hidden="true">
      <path d="M0 0H7M0 0V68" stroke="#00C450" strokeWidth="2" />
    </svg>
  );
}

function TitleBracketBR() {
  return (
    <svg className="hero__title-bracket hero__title-bracket--br" width="7" height="68" viewBox="0 0 7 68" fill="none" aria-hidden="true">
      <path d="M0 68H7M7 0V68" stroke="#00C450" strokeWidth="2" />
    </svg>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  return (
    <section className="hero" id="top" data-figma="hero">
      <div className="container hero__grid">
        <div className="hero__left">
          <span className="hero__badge" data-figma="hero-badge">
            <span className="hero__badge-dot" />
            Get the message every candidate wants:
          </span>

          <h1 className="hero__title">
            <span className="hero__title-inner" data-figma="hero-title">
              <span className="hero__title-bg hero__title-bg--1" aria-hidden="true" />
              <span className="hero__title-bg hero__title-bg--2" aria-hidden="true" />
              <TitleBracketTL />
              <TitleBracketBR />
              <span className="hero__title-line">You’re exactly who</span>
              <span className="hero__title-line hero__title-line--2">we’re looking for</span>
            </span>
          </h1>

          <p className="hero__lead" data-figma="hero-lead">
            Not getting interviews despite your experience?
            <br />
            Our tool will help yout to turn your experience into a job-winning asset.
          </p>

          <div className="hero__cta">
            <button className="btn btn--dark" data-figma="hero-create" onClick={() => navigate("/app/create")}>
              Create ATS Resume
            </button>
            <button className="btn btn--outline-dark" data-figma="hero-improve" onClick={() => navigate("/app/improve")}>
              Improve My Resume
            </button>
          </div>

          <div className="hero__stats" data-figma="hero-stats">
            {stats.map(({ Icon, size, num, desc }, index) => (
              <Fragment key={num}>
                {index > 0 && <div className="stat__divider" aria-hidden="true" />}
                <div className="stat" data-figma={`hero-stat-${index}`}>
                  <div className="stat__icon">
                    <Icon size={size} />
                  </div>
                  <div className="stat__body">
                    <div className="stat__num">{num}</div>
                    <div className="stat__desc">{desc}</div>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="hero__art" data-figma="hero-art">
          <div className="hero__stage">
            <img
              className="hero__cv-img"
              data-figma="hero-cv"
              src="/images/hero-cv-card.png"
              alt=""
              width={389}
              height={552}
              decoding="async"
            />

            <div className="badge-card badge-100" data-figma="hero-100">
              <svg className="badge-100__ring" width="86" height="84" viewBox="0 0 86 84" aria-hidden="true">
                <ellipse cx="43" cy="42" rx="38" ry="37" fill="none" stroke="#00DE81" strokeWidth="10" />
              </svg>
              <span className="badge-100__pct">100%</span>
              <span className="badge-100__label">ATS-Friendly</span>
            </div>

            <div className="badge-card badge-pdf" data-figma="hero-pdf">
              <FileDownloadIcon className="badge-pdf__icon" size={43} />
              <span className="badge-pdf__label">PDF / DOC</span>
            </div>

            <div className="badge-pill" data-figma="hero-pill">*Based on hiring best practices</div>
            <img className="hero__deco" src="/images/hero-deco.svg" alt="" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
