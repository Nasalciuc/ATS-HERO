"use client";
import { Fragment } from "react";
import { useNavigate } from "@/lib/router";
import { StatCv, StatScan, StatGraph, FileDownload } from "./icons";

const stats = [
  { Icon: StatCv, num: "75% of resumes", desc: "are filtered by ATS first before review" },
  { Icon: StatScan, num: "1 fast scan", desc: "can reveal what’s blocking your resume" },
  { Icon: StatGraph, num: "2–3× more likely", desc: "to land interviews with ATS optimization" },
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
    <section className="hero" id="top">
      <div className="container hero__grid">
        <div className="hero__left">
          <span className="hero__badge">
            <span className="hero__badge-dot" />
            Get the message every candidate wants:
          </span>

          <h1 className="hero__title">
            <span className="hero__title-inner">
              <span className="hero__title-bg hero__title-bg--1" aria-hidden="true" />
              <span className="hero__title-bg hero__title-bg--2" aria-hidden="true" />
              <TitleBracketTL />
              <TitleBracketBR />
              <span className="hero__title-line">You’re exactly who</span>
              <span className="hero__title-line hero__title-line--2">we’re looking for</span>
            </span>
          </h1>

          <p className="hero__lead">
            Not getting interviews despite your experience?
            <br />
            Our tool will help yout to turn your experience into a job-winning asset.
          </p>

          <div className="hero__cta">
            <button className="btn btn--dark" onClick={() => navigate("/app/create")}>
              Create ATS Resume
            </button>
            <button className="btn btn--outline-dark" onClick={() => navigate("/app/improve")}>
              Improve My Resume
            </button>
          </div>

          <div className="hero__stats">
            {stats.map(({ Icon, num, desc }, index) => (
              <Fragment key={num}>
                {index > 0 && <div className="stat__divider" aria-hidden="true" />}
                <div className="stat">
                  <div className="stat__icon">
                    <Icon />
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

        <div className="hero__art">
          <div className="hero__stage">
            <img
              className="hero__cv-img"
              src="/images/hero-cv-644b5f.png"
              alt=""
              width={389}
              height={552}
              decoding="async"
            />

            <div className="badge-card badge-100">
              <svg className="badge-100__ring" width="86" height="84" viewBox="0 0 86 84" aria-hidden="true">
                <ellipse cx="43" cy="42" rx="38" ry="37" fill="none" stroke="#00DE81" strokeWidth="10" />
              </svg>
              <span className="badge-100__pct">100%</span>
              <span className="badge-100__label">ATS-Friendly</span>
            </div>

            <div className="badge-card badge-pdf">
              <FileDownload className="badge-pdf__icon" size={32} />
              <span className="badge-pdf__label">PDF / DOC</span>
            </div>

            <div className="badge-pill">*Based on hiring best practices</div>
            <img className="hero__deco" src="/images/hero-deco.svg" alt="" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
