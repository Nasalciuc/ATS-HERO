"use client";
import { useState } from "react";
import { useNavigate } from "@/lib/router";
import { ChevronDown } from "./icons";

const cards = [
  {
    img: "/images/flow-create-2433fb.png",
    desc: "Build a professional CV with guided structure and recruiter-approved expert recommendations at every step.",
    cta: "Create ATS Resume",
    to: "/app/create",
    steps: [
      { title: "Fill in guided sections", body: "Contacts, education, summary, work and skills — one step at a time, with examples for your role." },
      { title: "Get tips as you type", body: "Weak phrasing and missing detail are flagged in place, so you fix them before you finish." },
      { title: "Export a clean file", body: "Download a PDF or DOCX that keeps its structure when a tracking system reads it." },
    ],
  },
  {
    img: "/images/flow-improve-7e14af.png",
    desc: "Upload your CV to receive instant feedback, clarity score, and personalized improvement recommendations.",
    cta: "Improve My Resume",
    to: "/app/improve",
    steps: [
      { title: "Upload or paste your CV", body: "PDF or plain text. We read the text layer, the same way a tracking system does." },
      { title: "See your ATS score", body: "A score per section, plus the critical mistakes that cost you the most." },
      { title: "Fix the flagged lines", body: "Each finding comes with what to change and why it matters to a recruiter." },
    ],
  },
  {
    img: "/images/flow-jobfit-7e14af.png",
    desc: "Compare your CV to a job and get match score, skill gap insights, and actionable optimization tips for better results.",
    cta: "Check Job Fit",
    to: "/app/jobfit",
    steps: [
      { title: "Add the job description", body: "Paste the posting next to your CV — no account needed to try it." },
      { title: "Read the match score", body: "See which keywords the posting expects and which ones your CV actually proves." },
      { title: "Close the gaps", body: "Add the missing skills you genuinely have, then re-check before you apply." },
    ],
  },
];

export default function Tool() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="tool" id="tool">
      <div className="container">
        <h2 className="tool__title">One tool. Three career superpowers.</h2>
        <div className="tool__grid">
          {cards.map((card, i) => (
            <article className="tool__card" key={card.cta}>
              <div className="tool__img">
                <img src={card.img} alt={card.cta} />
              </div>
              <p className="tool__desc">{card.desc}</p>
              <div className="tool__actions">
                <button className="btn btn--white" onClick={() => navigate(card.to)}>{card.cta}</button>
                <button
                  className="btn btn--outline-light"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  {open === i ? "Hide" : "How it works"}
                  <ChevronDown size={16} />
                </button>
              </div>

              {open === i && (
                <ol className="tool__timeline">
                  {card.steps.map((s) => (
                    <li className="tool__step" key={s.title}>
                      <span className="tool__step-dot" aria-hidden />
                      <h4 className="tool__step-title">{s.title}</h4>
                      <p className="tool__step-body">{s.body}</p>
                    </li>
                  ))}
                  <li className="tool__timeline-foot">
                    <button className="tool__hide" onClick={() => setOpen(null)}>Hide ↑</button>
                  </li>
                </ol>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
