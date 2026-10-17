// The parts of the legal pages (Privacy Policy, Terms and Conditions, Credits). No Figma frame: they
// are built from the landing's parts — the hero badge, the selected-text headline, the stats row,
// the builder's stepper nodes, the dark band and the FAQ's hairline rows (styles: "LEGAL PAGES" in
// app/styles.css).
import type { ComponentType, ReactNode } from "react";
import { BlockIcon } from "@/components/figma-icons";
import type { LegalDate } from "@/lib/legal";

export type LegalStat = { Icon: ComponentType<{ size?: number }>; size: number; num: string; desc: string };

/** The badge with the page's name and date, the two-line headline, the lead and the stats card. */
export function LegalHero({
  name,
  updated,
  title,
  lead,
  stats,
}: {
  name: string;
  updated?: LegalDate;
  title: [string, string];
  lead: ReactNode;
  stats: LegalStat[];
}) {
  return (
    <section className="legal-hero">
      <div className="container legal-hero__grid">
        <div>
          <p className="legal-hero__badge">
            <span className="legal-hero__dot" aria-hidden="true" />
            <span>
              {name}
              {updated && (
                <>
                  {" · updated "}
                  <time dateTime={updated.iso}>{updated.label}</time>
                </>
              )}
            </span>
          </p>
          <h1 className="legal-hero__title">
            <span className="sel-text">
              <span className="sel-line">
                <i className="sel-caret sel-caret--start" aria-hidden="true" />
                {title[0]}{" "}
              </span>
              <span className="sel-line">
                {title[1]}
                <i className="sel-caret sel-caret--end" aria-hidden="true" />
              </span>
            </span>
          </h1>
          <p className="legal-hero__lead">{lead}</p>
        </div>
        <aside className="legal-hero__card" aria-label="At a glance">
          <ul className="legal-hero__stats">
            {stats.map(({ Icon, size, num, desc }) => (
              <li className="stat" key={num}>
                <div className="stat__icon">
                  <Icon size={size} />
                </div>
                <div className="stat__body">
                  <div className="stat__num">{num}</div>
                  <div className="stat__desc">{desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export type LegalStep = {
  emoji: string;
  title: string;
  points: string[];
  /** the pill at the bottom of the card */
  tag: string;
  note?: { lead: string; text: string };
};

/** Moments drawn with the builder's stepper: 64px nodes joined by the green line. */
export function LegalSteps({ id, title, steps }: { id: string; title: string; steps: LegalStep[] }) {
  return (
    <section className="legal-steps" aria-labelledby={id}>
      <div className="container">
        <h2 className="legal-section-title" id={id}>
          {title}
        </h2>
        <ol className="legal-steps__list">
          {steps.map((step, i) => (
            <li className="legal-step" key={step.title}>
              <div className="legal-step__head">
                <span className="legal-step__node" aria-hidden="true">
                  <span className="legal-step__emoji">{step.emoji}</span>
                </span>
                <span className="legal-step__num">Step {i + 1}</span>
                <h3 className="legal-step__title">{step.title}</h3>
              </div>
              <div className="legal-step__card">
                <ul className="legal-step__points">
                  {step.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {step.note && (
                  <p className="legal-step__note">
                    <b>{step.note.lead}</b> {step.note.text}
                  </p>
                )}
                <p className="legal-step__tag">
                  <span className="legal-step__tag-dot" aria-hidden="true" />
                  {step.tag}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** The dark band: a short list of rules, each with the "block" icon. */
export function LegalBand({ id, title, items }: { id: string; title: string; items: { title: string; text: string }[] }) {
  return (
    <section className="legal-band" aria-labelledby={id}>
      <div className="container">
        <h2 className="legal-section-title legal-section-title--light" id={id}>
          {title}
        </h2>
        <ul className="legal-band__grid">
          {items.map((n) => (
            <li className="legal-band__item" key={n.title}>
              <BlockIcon className="legal-band__icon" />
              <div>
                <p className="legal-band__title">{n.title}</p>
                <p className="legal-band__text">{n.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export type LegalSection = { id: string; title: string; body: ReactNode };

/** The details: the table of contents (sticky on wide screens) and one block per section. */
export function LegalDetails({ id, title, sections }: { id: string; title: string; sections: LegalSection[] }) {
  return (
    <section className="legal-details" aria-labelledby={id}>
      <div className="container legal-details__grid">
        <nav className="legal-toc" aria-labelledby={id}>
          <h2 className="legal-toc__title" id={id}>
            {title}
          </h2>
          <ol className="legal-toc__list">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-details__body">
          {sections.map((s) => (
            <section className="legal-block" id={s.id} key={s.id}>
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

/** A table that turns into labelled rows on phones (each cell carries its column's name). */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="legal-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, i) => (
              <td key={i} data-label={head[i]}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
