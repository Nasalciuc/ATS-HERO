"use client";
// ATS Score: Figma "ATS Score Estimation_loading" (319:3807; 331:5590 with the Improve / Job Fit
// progress bar) and "ATS Score_Results" (319:4126; 383:8025 with the progress bar; 383:7664 with
// "Fix now" open). Checked by design-check/specs/score-*.json.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@/lib/router";
import AppShell from "../components/app/AppShell";
import AnalyzeSteps from "../components/app/AnalyzeSteps";
import { AlertLine, ArrowUp, CvDocument, EyeOptic, MinusThin, PlusThin, SaveDisk } from "../components/figma-icons";
import { useApp } from "../store/AppContext";
import { api } from "../lib/api";
import { SECTION_EMOJI, type JobFitReport, type ScoreReport, type SectionKey, type SectionReport } from "../lib/types";
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

/** Green from 80, amber from 50, red below (the colours of the Figma rows). */
const toneOf = (score: number): Tone => (score >= 80 ? "good" : score >= 50 ? "fair" : "poor");

/** The 157px score circle: the arc runs clockwise from 12 o'clock, `value`% of the way round. */
function ScoreCircle({ value, text, label, figma }: { value: number; text: string; label: string; figma?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`score-circle is-${toneOf(value)}`} data-figma={figma}>
      <svg className="score-circle__arc" viewBox="0 0 157 157" aria-hidden="true" focusable="false">
        <circle cx="78.5" cy="78.5" r="77.5" pathLength={100} strokeDasharray={`${pct} 100`} />
      </svg>
      <span className="score-circle__value">{text}</span>
      <span className="score-circle__label">{label}</span>
    </div>
  );
}

const BADGES = {
  critical: "Critical mistakes",
  suggestion: "Suggestions",
  good: "Good practices",
} as const;

function Group({ tone, items, figma }: { tone: keyof typeof BADGES; items: string[]; figma?: string }) {
  return (
    <div className="score-group">
      <span className={`score-badge score-badge--${tone}`} data-figma={figma}>
        <AlertLine /> {BADGES[tone]}
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
  const [report, setReport] = useState<ScoreReport | null>(null);
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
  const show = (r: ScoreReport, keep?: SectionKey | null) => {
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
      if (cached) {
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
        const { report: fresh } = await api.score({ text });
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
            <ScoreCircle value={report.generalScore} text={report.generalScore.toFixed(1)} label="General score" figma="score-circle" />
            <div className="score__msg">
              <p className="score__text" data-figma="score-text">
                {report.message}
              </p>
              <button className="topbtn topbtn--dark score__recalc" data-figma="btn-recalc" onClick={() => void recalculate()} disabled={busy}>
                {busy ? "Recalculating…" : "Recalculate Score"}
              </button>
            </div>
          </div>

          {jobFit && <JobFitPanel fit={jobFit} />}

          <ul className="score__list" data-figma="score-list" aria-label="Score by section">
            {report.sections.map((s, i) => (
              <ScoreRow
                key={s.key}
                s={s}
                index={i}
                open={open === s.key}
                fixing={fixing === s.key}
                onToggle={() => {
                  const next = open === s.key ? null : s.key;
                  setOpen(next);
                  // opening or closing any section ends a fix the way Back does
                  if (fixing) void finishFix(false, next);
                }}
                onFix={() => startFix(s.key)}
                form={fixing === s.key ? (textFlow ? <TextFix value={draft} onChange={setDraft} /> : renderSectionForm(s.key)) : null}
              />
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
