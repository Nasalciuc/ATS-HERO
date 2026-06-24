"use client";
import { useState } from "react";
import { Plus, Minus } from "./icons";

const faqs = [
  {
    q: "How is this different from a regular CV template?",
    a: "Unlike static templates, this tool actively helps you create a stronger, more effective CV. It guides you step by step, analyzes your content against real ATS and recruiter criteria, and provides personalized, actionable recommendations. Instead of just filling in a template, you build a CV optimized to pass screening systems, highlight your strengths, and significantly increase your chances of getting interview invitations.",
  },
  {
    q: "How to beat an Applicant Tracking System (ATS)?",
    a: "To pass ATS screening, your CV needs the right structure, relevant keywords, and clear formatting. Our tool guides you step by step, analyzes your CV against ATS criteria, and provides specific recommendations to improve your score. This helps ensure your CV passes the initial screening and reaches recruiters.",
  },
  {
    q: "What is the best way to get maximum interview calls?",
    a: "The key is having a resume that is both ATS-friendly and tailored to each job you apply for. Use a clear structure, include relevant keywords from the job description, and highlight measurable achievements instead of generic responsibilities. Our tool helps you optimize your resume, improve your ATS score, and ensure your profile stands out to recruiters, increasing your chances of getting more interview calls.",
  },
  {
    q: "What common mistakes can cause my resume to be rejected by ATS?",
    a: "Common mistakes include using complex or non-standard formatting, missing relevant keywords from the job description, unclear section structure, and including graphics or elements that ATS cannot read. Generic or vague descriptions of your experience can also lower your chances. Our tool identifies these issues, explains what needs improvement, and helps you optimize your resume to pass ATS screening and reach recruiters.",
  },
  {
    q: "Is an ATS-compliant resume necessary in today’s job market?",
    a: "Yes. Most companies use Applicant Tracking Systems (ATS) to filter resumes before recruiters review them. If your resume isn’t ATS-compliant, it may be rejected automatically, regardless of your qualifications. An ATS-optimized resume ensures your skills and experience are properly recognized, increasing your chances of reaching the recruiter and getting invited to an interview.",
  },
  {
    q: "Does an ATS-friendly resume still look good to human recruiters?",
    a: "Yes. An ATS-friendly resume is designed to be clear, well-structured, and easy to read, which benefits both ATS systems and human recruiters. Our tool ensures your resume meets technical requirements while maintaining a professional, modern design that highlights your strengths and makes a strong impression.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="faq" id="faq">
      <div className="container">
        <div className="faq__list">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className={`faq__item${isOpen ? " is-open" : ""}`} key={item.q}>
                <button
                  className="faq__q"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <span className="faq__toggle">{isOpen ? <Minus /> : <Plus />}</span>
                </button>
                <div className="faq__a">
                  <p className="faq__a-inner">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
