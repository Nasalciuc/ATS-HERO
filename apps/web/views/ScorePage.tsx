"use client";
// ATS Score: Figma "ATS Score Estimation_loading" (319:3807; 331:5590 with the Improve / Job Fit
// progress bar) and "ATS Score_Results" (319:4126; 383:8025 with the progress bar; 383:7664 with
// "Fix now" open). Checked by design-check/specs/score-*.json.
//
// Improve / Job Fit show the ATS check (lib/ats-read/score.ts), built from the same circle, rows,
// icons, badges, "Fix now" and +/− toggles: the fields the readers got ("7 / 9"), the findings on
// the parsers' levels (Critical / Major / Missing / Tip), what the readers got in each row, the
// text the robot read and the method. No score: no ATS gives one without a job (ATS-REAL-VS-NOI.md).
// PROVISIONAL (AGENTS.md rule 6): no Figma frame yet; Liubovi draws or checks it. The locked specs
// inject old-format builder reports, which render as before.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@/lib/router";
import AppShell from "../components/app/AppShell";
import AnalyzeSteps from "../components/app/AnalyzeSteps";
import { AlertLine, ArrowUp, CvDocument, EyeOptic, MinusThin, PlusThin, SaveDisk } from "../components/figma-icons";
import { useApp } from "../store/AppContext";
import { api } from "../lib/api";
import { storedAtsRead } from "../lib/analyze-flow";
import { SECTION_EMOJI, type JobFitReport, type ScoreReport, type SectionKey, type SectionReport } from "../lib/types";
import { fileLine, toneOfLevel, type AtsReport, type AtsSection, type Issue, type Note, type ReadField } from "../lib/ats-read/score";
import { LEVEL_ORDER, LEVELS, refLine, type Level } from "../lib/ats-read/levels";
import {
  PersonalInfoStep,
  EducationStep,
  SummaryStep,
  WorkStep,
  SkillsStep,
  AwardsStep,
  CertificationsStep,
  PublicationsStep,
  ActivitiesStep,
  VolunteeringStep,
} from "./builder/steps";

type AtsFlow = "create" | "improve" | "jobfit";
type Tone = "good" | "fair" | "poor";

function getAtsFlow(): AtsFlow {
  if (typeof window === "undefined") return "create";
  const f = sessionStorage.getItem("ats_flow");
  if (f === "improve" || f === "jobfit") return f;
  return "create";
}

type Report = ScoreReport | AtsReport;
const isAts = (r: Report | null): r is AtsReport => !!r && (r as AtsReport).kind === "ats-read" && (r as AtsReport).version === 2;
/** A report saved by an older version of the check (it had a 0–100 score): computed again. */
const isStaleAts = (r: unknown) => !!r && (r as { kind?: string }).kind === "ats-read" && (r as { version?: number }).version !== 2;

/** Green from 80, amber from 50, red below (the colours of the Figma rows). */
const toneOf = (score: number): Tone => (score >= 80 ? "good" : score >= 50 ? "fair" : "poor");

/** The 157px score circle: the arc runs clockwise from 12 o'clock, `value`% of the way round. */
function ScoreCircle({
  value,
  text,
  of,
  label,
  tone,
  figma,
}: {
  value: number;
  text: string;
  /** "7 / 9": the total, drawn smaller after the number */
  of?: number;
  label: string;
  tone?: Tone;
  figma?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`score-circle is-${tone ?? toneOf(value)}${of !== undefined ? " score-circle--fraction" : ""}`} data-figma={figma}>
      <svg className="score-circle__arc" viewBox="0 0 157 157" aria-hidden="true" focusable="false">
        <circle cx="78.5" cy="78.5" r="77.5" pathLength={100} strokeDasharray={`${pct} 100`} />
      </svg>
      <span className="score-circle__value">
        {text}
        {of !== undefined && <span className="score-circle__of"> / {of}</span>}
      </span>
      <span className="score-circle__label">{label}</span>
    </div>
  );
}

const BADGES = {
  critical: "Critical mistakes",
  suggestion: "Suggestions",
  good: "Good practices",
  recruiter: "For the recruiter, not the ATS",
} as const;

function Group({ tone, items, figma }: { tone: keyof typeof BADGES; items: string[]; figma?: string }) {
  return (
    <div className="score-group">
      <span className={`score-badge score-badge--${tone}`} data-figma={figma}>
        {tone !== "recruiter" && <AlertLine />} {BADGES[tone]}
      </span>
      <ol className="score-group__list">
        {items.map((it, i) => (
          <li key={i}>
            <span className="score-group__num" aria-hidden="true">
              ({i + 1})
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ScoreRow({
  s,
  index,
  open,
  fixing,
  onToggle,
  onFix,
  form,
}: {
  s: SectionReport;
  /** the first row carries the design-check keys (the second one its position) */
  index: number;
  open: boolean;
  fixing: boolean;
  onToggle: () => void;
  onFix: () => void;
  form: ReactNode;
}) {
  const tone = toneOf(s.score);
  const key = (k: string) => (index === 0 ? k : undefined);
  const bodyId = `score-body-${s.key}`;
  const fix = (phone: boolean) => (
    <button
      type="button"
      className={`topbtn topbtn--title topbtn--dark score-row__fix${phone ? " score-row__fix--phone" : ""}`}
      data-figma={phone ? undefined : key("row-fix")}
      data-fix={s.key}
      onClick={onFix}
    >
      Fix now
    </button>
  );
  return (
    <li className={`score-row${open ? " is-open" : ""}`}>
      <div className="score-row__head" data-figma={index < 2 ? `row-${index}` : undefined}>
        <span className="score-row__main">
          <span className={`score-row__icon is-${tone}`} aria-hidden="true" data-figma={key("row-icon")}>
            {SECTION_EMOJI[s.key]}
          </span>
          <span className="score-row__label" data-figma={key("row-label")}>
            {s.label}
          </span>
          <span className={`score-row__score is-${tone}`} data-figma={key("row-score")}>
            {Math.round(s.score)} / 100
          </span>
          <span className="score-row__entry" data-figma={key("row-entry")}>
            Entry score: {s.entryScore.toFixed(2)}
          </span>
        </span>
        {open && !fixing && fix(false)}
        <button
          type="button"
          className="score-row__toggle"
          data-figma={key("row-toggle")}
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          aria-label={`${s.label}: details`}
          onClick={onToggle}
        >
          {open ? <MinusThin /> : <PlusThin size={34} />}
        </button>
      </div>
      {open && (
        <div className="score-row__body" id={bodyId}>
          {s.critical.length > 0 && <Group tone="critical" items={s.critical} figma={key("badge-critical")} />}
          {s.suggestions.length > 0 && <Group tone="suggestion" items={s.suggestions} figma={key("badge-suggestion")} />}
          {s.goodPractices.length > 0 && <Group tone="good" items={s.goodPractices} figma={key("badge-good")} />}
          {/* under 1280px: "Fix now" under the advice (the row is too narrow for it) */}
          {!fixing && fix(true)}
          {fixing && (
            <div className="score-row__fixform" id={`score-fix-${s.key}`}>
              {form}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const MARK = {
  ok: { sign: "✓", label: "Read" },
  partial: { sign: "!", label: "Read differently or in part" },
  lost: { sign: "✕", label: "Not read" },
} as const;

/** What the two readers got in one section, field by field (provisional, rule 6). */
function ReadList({ reads, many }: { reads: ReadField[]; many: boolean }) {
  return (
    <div className="score-group score-group--wide">
      <span className="score-badge score-badge--read">{many ? "What the readers got" : "What the reader got"}</span>
      <ul className="score-reads">
        {reads.map((f, i) => (
          <li key={i} className={`score-reads__item is-${f.mark}`}>
            <span className="score-reads__mark" role="img" aria-label={MARK[f.mark].label}>
              {MARK[f.mark].sign}
            </span>
            <span className="score-reads__label">{f.label}</span>
            <span className="score-reads__value">
              {f.value ?? "—"}
              {f.note && <span className="score-reads__note">{f.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A finding's level, as a small badge in the colours of the score page. */
function LevelChip({ level }: { level: Level }) {
  return <span className={`score-badge score-level score-level--${level}`}>{LEVELS[level].label}</span>;
}

/** How many findings of each level, under the summary ("1 Critical · 2 Missing · 3 Tips"). */
function LevelCounts({ counts }: { counts: Record<Level, number> }) {
  const found = LEVEL_ORDER.filter((l) => counts[l] > 0);
  return (
    <ul className="score-levels" aria-label="Findings by level">
      {found.length === 0 ? (
        <li className="score-badge score-level score-level--none">No findings</li>
      ) : (
        found.map((l) => (
          <li key={l} className={`score-badge score-level score-level--${l}`}>
            <strong>{counts[l]}</strong> {counts[l] === 1 || l === "missing" ? LEVELS[l].label : `${LEVELS[l].label}s`}
          </li>
        ))
      )}
    </ul>
  );
}

/** One finding: its level, what happens, why, the source and the fix (provisional, rule 6). */
function Finding({ issue, card }: { issue: Issue; card?: boolean }) {
  const ref = refLine(issue.ref);
  return (
    <li className={card ? "score-fixfirst__item" : "score-finding"}>
      <div className="score-fixfirst__top">
        <h3 className="score-fixfirst__name">{issue.title}</h3>
        <LevelChip level={issue.level} />
      </div>
      <p className="score-fixfirst__why">
        {issue.why}
        {issue.source && (
          <>
            {" "}
            <a href={issue.source.url} target="_blank" rel="noopener noreferrer">
              {issue.source.label}
            </a>
          </>
        )}
      </p>
      <p className="score-fixfirst__fix">
        <strong>Fix:</strong> {issue.fix}
      </p>
      <p className="score-finding__ref">
        {ref ? `Parser codes: ${ref}` : "Our check: no parser code"}
        {issue.ref.deviation ? ` · Our level differs: ${issue.ref.deviation}.` : ""}
      </p>
    </li>
  );
}

/** The critical and major findings first; with none, what's missing (provisional, rule 6). */
function FixFirst({ issues }: { issues: Issue[] }) {
  const urgent = issues.filter((i) => i.level === "critical" || i.level === "major");
  const top = (urgent.length ? urgent : issues.filter((i) => i.level === "missing")).slice(0, 4);
  if (!top.length) return null;
  return (
    <section className="score-fixfirst" aria-labelledby="score-fixfirst-title">
      <h2 id="score-fixfirst-title" className="score-fixfirst__title">
        {urgent.length ? "What to fix first" : "What's missing"}
      </h2>
      <ol className="score-fixfirst__list">
        {top.map((i) => (
          <Finding key={i.code} issue={i} card />
        ))}
      </ol>
    </section>
  );
}

/** Things to know that aren't problems of the CV: pasted text, the CV's language. */
function Notes({ notes }: { notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <ul className="score-notes">
      {notes.map((n) => (
        <li key={n.code} className="score-note">
          <span className="score-note__icon" aria-hidden="true">
            i
          </span>
          <p>
            {n.text}
            {n.source && (
              <>
                {" "}
                <a href={n.source.url} target="_blank" rel="noopener noreferrer">
                  {n.source.label}
                </a>
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** A section of the ATS check: the row, then what the readers got, the findings and the advice. */
function AtsRow({
  s,
  many,
  open,
  fixing,
  onToggle,
  onFix,
  form,
}: {
  s: AtsSection;
  many: boolean;
  open: boolean;
  fixing: boolean;
  onToggle: () => void;
  onFix: () => void;
  form: ReactNode;
}) {
  const bodyId = `score-body-${s.key}`;
  const fix = (phone: boolean) => (
    <button
      type="button"
      className={`topbtn topbtn--title topbtn--dark score-row__fix${phone ? " score-row__fix--phone" : ""}`}
      data-fix={s.key}
      onClick={onFix}
    >
      Fix now
    </button>
  );
  return (
    <li className={`score-row score-row--ats${open ? " is-open" : ""}`}>
      <div className="score-row__head">
        <span className="score-row__main">
          <span className={`score-row__icon is-${s.tone}`} aria-hidden="true">
            {SECTION_EMOJI[s.key]}
          </span>
          <span className="score-row__label">{s.label}</span>
          <span className={`score-row__status is-${s.tone}`}>{s.status}</span>
        </span>
        {open && !fixing && fix(false)}
        <button
          type="button"
          className="score-row__toggle"
          aria-expanded={open}
          aria-controls={open ? bodyId : undefined}
          aria-label={`${s.label}: details`}
          onClick={onToggle}
        >
          {open ? <MinusThin /> : <PlusThin size={34} />}
        </button>
      </div>
      {open && (
        <div className="score-row__body" id={bodyId}>
          {s.reads.length > 0 && <ReadList reads={s.reads} many={many} />}
          {s.issues.length > 0 && (
            <ol className="score-findings" aria-label={`${s.label}: findings`}>
              {s.issues.map((i) => (
                <Finding key={i.code} issue={i} />
              ))}
            </ol>
          )}
          {s.recruiter.length > 0 && <Group tone="recruiter" items={s.recruiter} />}
          {!fixing && fix(true)}
          {fixing && (
            <div className="score-row__fixform" id={`score-fix-${s.key}`}>
              {form}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** How the check works, what it doesn't do, and what really filters people out. */
function Method() {
  return (
    <section className="score-method" aria-labelledby="score-method-title">
      <h2 id="score-method-title" className="score-method__title">
        How we check
      </h2>
      <ul>
        <li>
          Two free document readers take the text out of your file, in your browser: the first step every ATS parser
          does. A field counts as read when both get the same thing. Your file never leaves your device.
        </li>
        <li>
          The levels are the ones the Textkernel and RChilli resume parsers use: Critical is their “Fatal”, Major their
          “Major issue”, Missing their “Data missing”, Tip their “Suggested improvement”. Where our lab disagrees with
          them, the finding says so.
        </li>
        <li>
          There is no ATS score: without a job post, an ATS only reads you. With one, ATSs compare you to that job:
          that&apos;s Job Fit. We don&apos;t run any ATS&apos;s own parser or ranking.
        </li>
        <li>
          Most ATSs don&apos;t reject a CV on their own. What usually filters people out is the application form&apos;s
          questions (work permit, location, required licences) and the recruiter&apos;s search.
        </li>
      </ul>
    </section>
  );
}

/** "See the text the robot read": the weakest reading's text, in a row like the sections. */
function RobotRow({ text, readings }: { text: string; readings: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`score-row${open ? " is-open" : ""}`}>
      <div className="score-row__head">
        <span className="score-row__main">
          <span className="score-row__icon is-neutral" aria-hidden="true">
            🔍
          </span>
          <span className="score-row__label">Text the robot read</span>
          <span className="score-row__entry score-row__entry--status">
            {readings > 1 ? `the weaker of ${readings} readings` : "your pasted text"}
          </span>
        </span>
        <button
          type="button"
          className="score-row__toggle"
          aria-expanded={open}
          aria-controls={open ? "score-robot" : undefined}
          aria-label="Text the robot read: show"
          onClick={() => setOpen(!open)}
        >
          {open ? <MinusThin /> : <PlusThin size={34} />}
        </button>
      </div>
      {open && (
        <div className="score-row__body" id="score-robot">
          <p className="score-robot__hint">The exact text, in the order a reader took it. Compare it with your CV: what&apos;s glued, moved or missing here is what an ATS gets wrong.</p>
          <pre className="score-robot">{text}</pre>
        </div>
      )}
    </li>
  );
}

/** Improve / Job Fit: the score comes from the pasted text, so "Fix now" edits that text. */
function TextFix({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="builder__panel score-textfix" data-figma="form-card">
      <label className="field__label" htmlFor="score-textfix">
        YOUR CV TEXT
      </label>
      <textarea id="score-textfix" className="analyze-textarea score-textfix__area" value={value} onChange={(e) => onChange(e.target.value)} />
      <p className="score-textfix__hint">Save re-scores the edited text; Back leaves it as it was.</p>
    </div>
  );
}

function JobFitPanel({ fit }: { fit: JobFitReport }) {
  const value = Math.round(fit.matchScore);
  return (
    <section className="score__head score__head--fit" aria-label="Job match" data-figma="jobfit">
      <ScoreCircle value={value} text={`${value}%`} label="Job match" />
      <div className="score__msg">
        <p className="score__text">{fit.message}</p>
        {fit.matched.length > 0 && (
          <div className="score-keywords">
            <span className="score-badge score-badge--good">Matched keywords</span>
            <ul className="score-keywords__list">
              {fit.matched.slice(0, 12).map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        )}
        {fit.missing.length > 0 && (
          <div className="score-keywords">
            <span className="score-badge score-badge--critical">Missing keywords</span>
            <ul className="score-keywords__list">
              {fit.missing.slice(0, 12).map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default function ScorePage() {
  const { data, update, updateLater, save, saving, saveError, ready } = useApp();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [jobFit, setJobFit] = useState<JobFitReport | null>(null);
  const [open, setOpen] = useState<SectionKey | null>(null);
  const [fixing, setFixing] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState(""); // Improve / Job Fit: the text being fixed
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false); // Improve / Job Fit: "Saved" for a moment
  const savedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);
  const [flow, setFlow] = useState<AtsFlow>("create");
  // Improve / Job Fit with the analysed text kept: "Fix now" edits that text
  const [textFlow, setTextFlow] = useState(false);
  const started = useRef(false);
  // before paint, so the Improve / Job Fit progress bar doesn't pop in a frame late
  useLayoutEffect(() => {
    const f = getAtsFlow();
    setFlow(f);
    setTextFlow(f !== "create" && sessionStorage.getItem("ats_text") !== null);
  }, []);
  const fromAnalyze = flow === "improve" || flow === "jobfit";

  const backHref = flow === "jobfit" ? "/app/jobfit" : flow === "improve" ? "/app/improve" : "/app/create";

  // first show: the first section open; after a re-score (`keep` given): the same one, or none
  const show = (r: Report, keep?: SectionKey | null) => {
    setReport(r);
    if (keep === undefined) setOpen(r.sections[0]?.key ?? null);
    else setOpen(keep && r.sections.some((x) => x.key === keep) ? keep : null);
  };

  // No artificial wait: the loading screen shows only while the score is really being computed
  // (the builder's CV still loading). Improve / Job Fit arrive with their report ready.
  const compute = async () => {
    setLoading(true);
    try {
      const cached = sessionStorage.getItem("ats_report");
      const stale = cached ? isStaleAts(JSON.parse(cached)) : false;
      const text = sessionStorage.getItem("ats_text");
      if (stale && text) {
        // saved by the old check, with its 0–100 score: check the same text (and file) again
        const { report: fresh } = await api.score({ text, ats: storedAtsRead() });
        sessionStorage.setItem("ats_report", JSON.stringify(fresh));
        show(fresh);
        const fit = sessionStorage.getItem("ats_jobfit");
        if (fit) setJobFit(JSON.parse(fit));
      } else if (cached && !stale) {
        show(JSON.parse(cached));
        const fit = sessionStorage.getItem("ats_jobfit");
        if (fit) setJobFit(JSON.parse(fit));
      } else {
        show((await api.score({ data })).report);
      }
    } finally {
      setLoading(false);
    }
  };

  // A results page opened directly (reload) scores the builder's CV: wait until it has loaded.
  useEffect(() => {
    if (started.current) return;
    if (!sessionStorage.getItem("ats_report") && !ready) return;
    started.current = true;
    void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Fix now shows the section's builder form in its Figma card (383:7664)
  const renderSectionForm = (key: SectionKey) => {
    const props = { data, update, updateLater, framed: true };
    switch (key) {
      case "personalInfo": return <PersonalInfoStep {...props} />;
      case "education": return <EducationStep {...props} />;
      case "summary": return <SummaryStep {...props} />;
      case "work": return <WorkStep {...props} />;
      case "skills": return <SkillsStep {...props} />;
      case "awards": return <AwardsStep {...props} />;
      case "certifications": return <CertificationsStep {...props} />;
      case "publications": return <PublicationsStep {...props} />;
      case "activities": return <ActivitiesStep {...props} />;
      case "volunteering": return <VolunteeringStep {...props} />;
      default: return null;
    }
  };

  // Improve / Job Fit score the text that was analysed (kept by the analyze page); the builder
  // flow scores the CV being edited.
  const recalculate = async (keep: SectionKey | null = open) => {
    setBusy(true);
    try {
      const text = fromAnalyze ? sessionStorage.getItem("ats_text") : null;
      if (text) {
        // the same file again while the text is unchanged (an edited text is scored as text)
        const { report: fresh } = await api.score({ text, ats: storedAtsRead() });
        sessionStorage.setItem("ats_report", JSON.stringify(fresh));
        const jd = flow === "jobfit" ? sessionStorage.getItem("ats_jd") : null;
        if (jd) {
          const { report: fit } = await api.jobfit(text, jd);
          sessionStorage.setItem("ats_jobfit", JSON.stringify(fit));
          setJobFit(fit);
        }
        show(fresh, keep);
      } else {
        sessionStorage.removeItem("ats_report");
        sessionStorage.removeItem("ats_jobfit");
        setJobFit(null);
        show((await api.score({ data })).report, keep);
      }
    } finally {
      setBusy(false);
    }
  };

  // Figma 383:7664: while a section is being fixed the title buttons are "Back" (close the form)
  // and "Save". Builder flow: the form edits the CV as you type, so both re-score (Save also saves
  // the CV). Improve / Job Fit: Save re-scores the edited text, Back drops the edit.
  const startFix = (key: SectionKey) => {
    if (textFlow) setDraft(sessionStorage.getItem("ats_text") ?? "");
    setFixing(key);
  };
  const finishFix = async (persist: boolean, keep: SectionKey | null = open) => {
    setFixing(null);
    if (textFlow) {
      if (!persist) return;
      sessionStorage.setItem("ats_text", draft);
      // a draft saved with Save follows the edit, so the analyze page doesn't show an older text
      if (sessionStorage.getItem(`ats_${flow}_cv`) !== null) sessionStorage.setItem(`ats_${flow}_cv`, draft);
    } else if (persist) {
      await save();
    }
    await recalculate(keep);
  };

  // Focus follows the form: into its first field when it opens, back to the section's
  // "Fix now" when it closes (the button under focus would otherwise vanish).
  const lastFixed = useRef<SectionKey | null>(null);
  useEffect(() => {
    if (fixing) {
      lastFixed.current = fixing;
      document.querySelector<HTMLElement>(`#score-fix-${fixing} :is(input, textarea, select, button)`)?.focus();
    } else if (lastFixed.current) {
      const key = lastFixed.current;
      lastFixed.current = null;
      const visible = [...document.querySelectorAll<HTMLElement>(`[data-fix="${key}"]`)].find((b) => b.offsetParent !== null);
      visible?.focus();
    }
  }, [fixing]);

  // Improve / Job Fit have no builder CV to save: Save keeps the analysed text as the analyze
  // page's draft (it used to create an empty CV for a guest).
  const saveText = () => {
    const text = sessionStorage.getItem("ats_text") ?? "";
    sessionStorage.setItem(`ats_${flow}_cv`, text);
    if (flow === "jobfit") sessionStorage.setItem("ats_jobfit_jd", sessionStorage.getItem("ats_jd") ?? "");
    setSaved(true);
    window.clearTimeout(savedTimer.current); // a second click restarts the 1.6 s, not cut it short
    savedTimer.current = window.setTimeout(() => setSaved(false), 1600);
  };
  const saveButton = (
    <button
      className="topbtn topbtn--title topbtn--dark"
      data-figma="btn-save"
      onClick={() => void (fixing ? finishFix(true) : textFlow ? saveText() : save())}
      title={!textFlow && saveError ? `Not saved: ${saveError}` : undefined}
    >
      <SaveDisk />{" "}
      {/* live only where the label confirms a click ("Saved"); in the builder flow it would read
          out every autosave's "Saving…" */}
      <span className="topbtn__label" aria-live={textFlow ? "polite" : undefined}>
        {textFlow ? (saved ? "Saved" : "Save") : saving ? "Saving…" : saveError ? "Retry save" : "Save"}
      </span>
    </button>
  );
  // phones use the top bar's "‹ Back" (same action)
  const backButton = (onClick: () => void) => (
    <button className="topbtn topbtn--step topbtn--ghost topbtn--no-phone" data-figma="btn-back" onClick={onClick}>
      <ArrowUp className="topbtn__arrow--left" /> Back
    </button>
  );
  const leave = () => navigate(backHref);
  const closeFix = () => void finishFix(false);

  const showResults = !loading && report;
  const headerActions = !showResults ? (
    <>
      {backButton(leave)}
      {saveButton}
    </>
  ) : fixing ? (
    <>
      {backButton(closeFix)}
      {saveButton}
    </>
  ) : (
    <>
      <button className="topbtn topbtn--title topbtn--ghost" data-figma="btn-preview" onClick={() => navigate("/app/create")}>
        <EyeOptic /> <span className="topbtn__label">Preview</span>
      </button>
      {saveButton}
    </>
  );

  return (
    <AppShell
      title={showResults ? "ATS Score Results" : "ATS Score Estimation"}
      active={flow}
      section="ATS Score"
      variant="score"
      onBack={showResults && fixing ? closeFix : leave}
      actions={headerActions}
    >
      {!showResults ? (
        <div className="score-wait">
          {fromAnalyze && <AnalyzeSteps current={1} />}
          <div className="ats-loading" data-figma="loading">
            <div className="ats-loading__badge" data-figma="loading-circle">
              <svg className="ats-loading__ring" viewBox="0 0 236 236" aria-hidden="true" focusable="false">
                <circle cx="118" cy="118" r="117" pathLength={360} strokeDasharray="334 26" transform="rotate(27 118 118)" />
              </svg>
              <CvDocument className="ats-loading__icon" />
            </div>
            <p className="ats-loading__msg" role="status" data-figma="loading-msg">
              <span aria-hidden="true">🔍 </span>Hunting for hidden resume glitches...
            </p>
          </div>
        </div>
      ) : (
        <div className="score">
          {fromAnalyze && <AnalyzeSteps current={1} />}
          <div className="score__head" data-figma="score-head">
            {isAts(report) ? (
              <ScoreCircle
                value={report.fields.total ? (100 * report.fields.read) / report.fields.total : 0}
                text={String(report.fields.read)}
                of={report.fields.total}
                label="fields read"
                tone={toneOfLevel(report.worst, false)}
                figma="score-circle"
              />
            ) : (
              <ScoreCircle value={report.generalScore} text={report.generalScore.toFixed(1)} label="General score" figma="score-circle" />
            )}
            <div className={`score__msg${isAts(report) ? " score__msg--ats" : ""}`}>
              <p className="score__text" data-figma="score-text">
                {report.message}
              </p>
              {isAts(report) && <p className="score__file">{fileLine(report)}</p>}
              {isAts(report) && <LevelCounts counts={report.counts} />}
              <button className="topbtn topbtn--dark score__recalc" data-figma="btn-recalc" onClick={() => void recalculate()} disabled={busy}>
                {isAts(report) ? (busy ? "Checking…" : "Check again") : busy ? "Recalculating…" : "Recalculate Score"}
              </button>
            </div>
          </div>
          {isAts(report) && <Notes notes={report.notes} />}

          {jobFit && <JobFitPanel fit={jobFit} />}

          {isAts(report) && <FixFirst issues={report.issues} />}
          {isAts(report) && report.good.length > 0 && (
            <div className="score-good">
              <Group tone="good" items={report.good} />
            </div>
          )}

          <ul className="score__list" data-figma="score-list" aria-label={isAts(report) ? "What the readers got, by section" : "Score by section"}>
            {(report.sections as (SectionReport | AtsSection)[]).map((s, i) => {
              const props = {
                open: open === s.key,
                fixing: fixing === s.key,
                onToggle: () => {
                  const next = open === s.key ? null : s.key;
                  setOpen(next);
                  // opening or closing any section ends a fix the way Back does
                  if (fixing) void finishFix(false, next);
                },
                onFix: () => startFix(s.key),
                form: fixing === s.key ? (textFlow ? <TextFix value={draft} onChange={setDraft} /> : renderSectionForm(s.key)) : null,
              };
              return isAts(report) ? (
                <AtsRow key={s.key} s={s as AtsSection} many={report.readings > 1} {...props} />
              ) : (
                <ScoreRow key={s.key} s={s as SectionReport} index={i} {...props} />
              );
            })}
            {isAts(report) && <RobotRow text={report.robotText} readings={report.readings} />}
          </ul>

          {isAts(report) && flow === "improve" && (
            <section className="score-next" aria-labelledby="score-next-title">
              <div className="score-next__text">
                <h2 id="score-next-title" className="score-next__title">
                  Match with a job
                </h2>
                <p>ATSs compare you to a specific job. Paste a job post to see which of its requirements your CV meets.</p>
              </div>
              <button type="button" className="topbtn topbtn--dark score-next__btn" onClick={() => navigate("/app/jobfit")}>
                Check Job Fit
              </button>
            </section>
          )}
          {isAts(report) && <Method />}
        </div>
      )}
    </AppShell>
  );
}
