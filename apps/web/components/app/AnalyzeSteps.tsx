"use client";
import { Fragment } from "react";

/** Figma "Progressbar" of Functions 2/3 (331:5781): three 64px tabs joined by 156px connectors. */
const ANALYZE_STEPS = [
  { label: "Adding CV", emoji: "📋" },
  { label: "ATS-Analysis", emoji: "📊" },
  { label: "Improvement", emoji: "💡" },
];

/** The Improve / Job Fit flow's stepper (also on its Score pages): `current` is 0, 1 or 2. */
export default function AnalyzeSteps({ current }: { current: number }) {
  return (
    <ol className="analyze-steps" data-figma="analyze-steps" aria-label="Progress">
      {ANALYZE_STEPS.map((s, i) => {
        const state = i === current ? " is-current" : i < current ? " is-done" : "";
        return (
          <Fragment key={s.label}>
            {i > 0 && <li className={`analyze-step__line${i <= current ? " is-filled" : ""}`} aria-hidden="true" />}
            <li className="analyze-step" aria-current={i === current ? "step" : undefined}>
              <span className={`analyze-step__node${state}`} data-figma={`analyze-step-${i}`}>
                <span className="analyze-step__emoji" aria-hidden="true">{s.emoji}</span>
              </span>
              <span className={`analyze-step__label${state}`}>{s.label}</span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
