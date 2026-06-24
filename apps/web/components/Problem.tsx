"use client";
import { Block } from "./icons";

const struggles = [
  "You apply to dozens of jobs without response",
  "Your experience sounds weaker than it really is",
  "Your CV gets ignored by ATS systems",
  "You don’t know what recruiters actually look for",
];

export default function Problem() {
  return (
    <section className="problem" id="why">
      <div className="container problem__grid">
        <div>
          <h2 className="problem__title">
            Your CV isn’t weak.
            <br />
            It’s just untranslated.
          </h2>
          <p className="problem__body">
            Most CVs never reach human eyes. Up to 75% are filtered out by
            automated systems before a recruiter even opens them.
          </p>
        </div>

        <div>
          <p className="problem__eyebrow">
            We know what most job seekers struggle with:
          </p>
          <ul className="problem__list">
            {struggles.map((text) => (
              <li className="problem__item" key={text}>
                <Block size={24} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
