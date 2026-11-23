// The figures a post places in its Markdown with a marker: a fenced block named blog-<name>
// (```blog-levels```). Their data lives in the post's frontmatter (lib/blog/schema.ts); a marker whose
// data is missing stops the build, and tests/blog.test.ts checks every post's markers.
import type { ReactNode } from "react";
import { LEVELS, LEVEL_ORDER } from "@/lib/ats-read/levels";
import { formatDate } from "@/lib/blog/text";
import type { AtsScore, Post } from "@/lib/blog/schema";
import { CHECK_HREF } from "./parts";

type BlockProps = { post: Post };

function need<T>(value: T | undefined, post: Post, field: string): T {
  if (value === undefined) throw new Error(`content/blog/${post.slug}.md: the body uses a figure that needs "${field}" in the frontmatter`);
  return value;
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function ShortAnswer({ post }: BlockProps) {
  const items = need(post.shortAnswer, post, "shortAnswer");
  return (
    <section className="blog-answer" id="short-answer" aria-labelledby="short-answer-title">
      <h2 className="blog-answer__title" id="short-answer-title">
        The short answer
      </h2>
      <ul className="blog-answer__list">
        {items.map((item) => (
          <li className="blog-answer__item" key={item.lead}>
            <span className="blog-answer__tick" aria-hidden="true">
              <Tick />
            </span>
            <span>
              <strong>{item.lead}</strong> {item.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The builder's stepper, telling the four steps every ATS takes. */
function ReadSteps() {
  const steps: { title: string; text: string; icon: ReactNode }[] = [
    {
      title: "Your file",
      text: "PDF or Word",
      icon: (
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5" />
        </>
      ),
    },
    { title: "Text", text: "taken out by a text reader", icon: <path d="M4 6h16M4 10h16M4 14h10M4 18h13" /> },
    {
      title: "Fields",
      text: "name, jobs, dates, skills",
      icon: (
        <>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="2.6" />
        </>
      ),
    },
    {
      title: "Profile",
      text: "what recruiters search",
      icon: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      ),
    },
  ];
  return (
    <figure className="blog-steps">
      <ol className="blog-steps__list" aria-label="How an ATS reads a CV">
        {steps.map((step, i) => (
          <li className={`blog-steps__step${i === steps.length - 1 ? " is-current" : ""}`} key={step.title}>
            <span className="blog-steps__circle" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                {step.icon}
              </svg>
            </span>
            <span className="blog-steps__title">{step.title}</span>
            <span className="blog-steps__text">{step.text}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** The parsers' four levels, in the colours the Improve screen gives them. */
function LevelList({ post }: BlockProps) {
  const notes = need(post.levels, post, "levels");
  return (
    <ul className="blog-levels" aria-label="The four levels resume parsers use">
      {LEVEL_ORDER.map((level) => (
        <li className="blog-levels__row" key={level}>
          <span className="blog-levels__chip">
            <span className={`score-badge score-level score-level--${level}`}>{LEVELS[level].vendor}</span>
          </span>
          <span className="blog-levels__text">
            {notes[level].meaning}
            <span className="blog-levels__example">For example: {notes[level].example}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecruiterSees({ score }: { score: AtsScore }) {
  switch (score.kind) {
    case "grades":
      return (
        <span className="blog-score__grades">
          {score.shows.map((grade, i) => (
            <span className={`blog-score__grade${i === 0 ? " is-picked" : ""}`} key={grade}>
              {grade}
            </span>
          ))}
        </span>
      );
    case "levels":
      return (
        <span className="blog-score__levels">
          {score.shows.map((level, i) => (
            <span className={`blog-score__level${i === 0 ? " is-picked" : ""}`} key={level}>
              {level}
            </span>
          ))}
        </span>
      );
    case "stars":
      return (
        <span className="blog-score__stars" role="img" aria-label={`${score.filled} of ${score.of} stars`}>
          <span aria-hidden="true">{"★".repeat(score.filled)}</span>
          <span className="blog-score__stars-off" aria-hidden="true">
            {"★".repeat(Math.max(0, score.of - score.filled))}
          </span>
        </span>
      );
    case "label":
      return (
        <span className="blog-score__levels">
          <span className="blog-score__level is-violet">{score.shows[0]}</span>
        </span>
      );
  }
}

function AtsScores({ post }: BlockProps) {
  const scores = need(post.atsScores, post, "atsScores");
  return (
    <ul className="blog-scores">
      {scores.map((score) => (
        <li className="blog-score" key={score.ats}>
          <span className="blog-score__ats">{score.ats}</span>
          <span className="blog-score__screen">
            <span className="blog-score__label">The recruiter sees</span>
            <RecruiterSees score={score} />
            <span className="blog-score__note">{score.note}</span>
          </span>
          <span className="blog-score__against">
            <strong>Compared with</strong> {score.comparedWith}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TitleFilter({ post }: BlockProps) {
  const f = need(post.titleFilter, post, "titleFilter");
  return (
    <figure className="blog-filter">
      <div className="blog-filter__cards">
        <div className="blog-filter__card">
          <span className="blog-filter__label">Job title, as the parser read it</span>
          <span className="blog-filter__value">{f.parsed}</span>
          <span className="score-badge score-level score-level--major">{f.issue}</span>
        </div>
        <div className="blog-filter__card">
          <span className="blog-filter__label">The recruiter’s filter</span>
          <span className="blog-filter__search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            {f.filter}
          </span>
          <span className="blog-filter__result">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
            {f.result}
          </span>
        </div>
      </div>
      <figcaption className="blog-filter__caption">{f.caption}</figcaption>
    </figure>
  );
}

function LabResults({ post }: BlockProps) {
  const lab = need(post.lab, post, "lab");
  return (
    <figure className="blog-lab">
      <figcaption className="blog-lab__date">Run of {formatDate(lab.date)}</figcaption>
      <ul className="blog-lab__stats">
        {lab.results.map((result) => (
          <li className="blog-lab__stat" key={result.label}>
            <span className="blog-lab__num">
              {result.passed} of {result.runs}
            </span>
            <span
              className="blog-lab__bar"
              role="img"
              aria-label={`${result.passed} of ${result.runs} passed`}
            >
              <span className="blog-lab__fill" style={{ width: `${(100 * result.passed) / result.runs}%` }} />
            </span>
            <span className="blog-lab__label">{result.label}</span>
          </li>
        ))}
      </ul>
      <p className="blog-lab__note">{lab.note}</p>
    </figure>
  );
}

function InlineCheck() {
  return (
    <aside className="blog-cta" aria-labelledby="blog-cta-title">
      <div className="blog-cta__text">
        <span className="blog-cta__badge">Free ATS check</span>
        <p className="blog-cta__title" id="blog-cta-title">
          See what an ATS reads from your CV
        </p>
        <p className="blog-cta__note">Free, no account. Your file stays in your browser.</p>
      </div>
      <a className="blog-cta__drop" href={CHECK_HREF}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
        </svg>
        <span className="blog-cta__drop-title">Check my CV</span>
        <span className="blog-cta__drop-text">PDF or Word file</span>
      </a>
    </aside>
  );
}

/** Marker name (the part after "blog-") → figure. */
export const BLOCKS: Record<string, (props: BlockProps) => ReactNode> = {
  "short-answer": ShortAnswer,
  steps: ReadSteps,
  levels: LevelList,
  "ats-scores": AtsScores,
  "title-filter": TitleFilter,
  lab: LabResults,
  cta: InlineCheck,
};

/** The frontmatter field each figure reads, for the checks in tests/blog.test.ts. */
export const BLOCK_DATA: Record<string, keyof Post | null> = {
  "short-answer": "shortAnswer",
  steps: null,
  levels: "levels",
  "ats-scores": "atsScores",
  "title-filter": "titleFilter",
  lab: "lab",
  cta: null,
};
