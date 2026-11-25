"use client";
import { BlockIcon } from "./figma-icons";

const struggles = [
  "You apply to dozens of jobs without response",
  "Your experience sounds weaker than it really is",
  "Your CV gets ignored by ATS systems",
  "You don’t know what recruiters actually look for",
];

export default function Problem() {
  return (
    <section className="problem" id="why" data-figma="problem">
      <div className="container problem__grid">
        <div>
          <h2 className="problem__title" data-figma="problem-title">
            Your CV isn’t weak.
            <br />
            It’s just untranslated.
          </h2>
          <p className="problem__body" data-figma="problem-text">
            Most CVs never reach human eyes.
            <br />
            Up to 75% are filtered out by automated systems before a recruiter even opens them.
          </p>
        </div>

        <div>
          <p className="problem__eyebrow" data-figma="problem-label">
            We know what most job seekers struggle with:
          </p>
          <ul className="problem__list">
            {struggles.map((text, i) => (
              <li className="problem__item" key={text} data-figma={`problem-item-${i}`}>
                <BlockIcon />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
