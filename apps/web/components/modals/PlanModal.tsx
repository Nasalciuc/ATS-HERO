"use client";
import Modal from "../ui/Modal";
import { Check } from "../icons";

const benefits = [
  "Pass ATS and get seen by recruiters",
  "Improve your CV with clear, instant feedback",
  "Highlight your strengths the right way",
  "Check your resume–job match",
  "Tailor your resume to any job",
];

export default function PlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} variant="side">
      <div className="plan">
        <h2 className="plan__title">All-in-one plan</h2>
        <p className="plan__subtitle">Single plan with full functionality and no limitations</p>

        <div className="plan__card">
          <div className="plan__price">
            29,99 US $ <span>monthly</span>
          </div>
          <div className="plan__renew">(with automatic renewal)</div>
          <button className="plan__cta">Get Try 14 days for $0.99</button>
        </div>

        <ul className="plan__benefits">
          {benefits.map((b) => (
            <li key={b}>
              <Check size={18} /> {b}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
