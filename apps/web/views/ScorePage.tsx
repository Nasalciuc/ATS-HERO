"use client";
import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router";
import AppShell from "../components/app/AppShell";
import AnalyzeSteps from "../components/app/AnalyzeSteps";
import {
  Eye,
  Save,
  Plus,
  Minus,
  Warn,
  Check,
  SectionIcon,
  ArrowLeft,
  LoadingResume,
  Magnify,
  LightbulbBadge,
} from "../components/icons";
import { useApp } from "../store/AppContext";
import { api } from "../lib/api";
import type { JobFitReport, ScoreReport, SectionKey } from "../lib/types";
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

function getAtsFlow(): AtsFlow {
  if (typeof window === "undefined") return "create";
  const f = sessionStorage.getItem("ats_flow");
  if (f === "improve" || f === "jobfit") return f;
  return "create";
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--green)";
  if (score >= 50) return "#E8A91D";
  return "var(--red)";
}

const ICON_KEYS = new Set<SectionKey>([
  "personalInfo", "education", "summary", "work", "skills",
  "activities", "awards", "certifications", "publications", "volunteering",
]);

export default function ScorePage() {
  const { data, update, save, saving } = useApp();
  const navigate = useNavigate();
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [jobFit, setJobFit] = useState<JobFitReport | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [fixing, setFixing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [flow, setFlow] = useState<AtsFlow>("create");
  useEffect(() => setFlow(getAtsFlow()), []);
  const fromAnalyze = flow === "improve" || flow === "jobfit";

  const backHref = flow === "jobfit" ? "/app/jobfit" : flow === "improve" ? "/app/improve" : "/app/create";

  const compute = async () => {
    setLoading(true);
    const started = Date.now();
    const MIN_LOADING_MS = 1500;
    try {
      const cached = sessionStorage.getItem("ats_report");
      if (cached) {
        setReport(JSON.parse(cached));
        const fit = sessionStorage.getItem("ats_jobfit");
        if (fit) setJobFit(JSON.parse(fit));
        setOpen(JSON.parse(cached).sections?.[0]?.key ?? null);
      } else {
        const { report } = await api.score({ data });
        setReport(report);
        setOpen(report.sections[0]?.key ?? null);
      }
    } finally {
      const wait = MIN_LOADING_MS - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setLoading(false);
    }
  };

  useEffect(() => {
    void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading) return;
    setSecondsLeft(30);
    const id = setInterval(() => setSecondsLeft((s) => (s > 1 ? s - 1 : s)), 800);
    return () => clearInterval(id);
  }, [loading]);

  const renderSectionForm = (key: SectionKey) => {
    const props = { data, update };
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

  const recalculate = async () => {
    sessionStorage.removeItem("ats_report");
    sessionStorage.removeItem("ats_jobfit");
    setJobFit(null);
    const { report: fresh } = await api.score({ data });
    setReport(fresh);
    setOpen(fresh.sections[0]?.key ?? null);
  };

  const headerActions = loading || fixing ? (
    <>
      <button className="topbtn topbtn--ghost" onClick={() => navigate(backHref)}>
        <ArrowLeft size={18} /> Back
      </button>
      <button className="topbtn topbtn--dark" onClick={() => void save()}>
        <Save size={18} /> {saving ? "Saving…" : "Save"}
      </button>
    </>
  ) : (
    <>
      <button className="topbtn topbtn--ghost" onClick={() => navigate("/app/create")}>
        <Eye size={18} /> Preview
      </button>
      <button className="topbtn topbtn--dark" onClick={() => void save()}>
        <Save size={18} /> {saving ? "Saving…" : "Save"}
      </button>
    </>
  );

  return (
    <AppShell
      title={loading ? "ATS Score Estimation" : "ATS Score Results"}
      active={flow}
      actions={headerActions}
    >
      {loading || !report ? (
        <>
          {fromAnalyze && <AnalyzeSteps current={1} />}
          <div className="ats-loading">
            <div className="ats-loading__badge">
              <span className="ats-loading__ring" aria-hidden />
              <LoadingResume size={52} />
            </div>
            <p className="ats-loading__msg">
              <Magnify size={18} /> Hunting for hidden resume glitches…
            </p>
            <p className="ats-loading__time">{secondsLeft} sec left</p>
          </div>
        </>
      ) : (
        <div className="score">
          {fromAnalyze && <AnalyzeSteps current={1} />}
          <div className="score__head">
            <div className="score__circle" style={{ borderColor: scoreColor(report.generalScore) }}>
              <span className="score__value" style={{ color: scoreColor(report.generalScore) }}>
                {report.generalScore.toFixed(1)}
              </span>
              <span className="score__caption">General score</span>
            </div>
            <div className="score__msg">
              <p>{report.message}</p>
              <button className="topbtn topbtn--dark" onClick={() => void recalculate()}>
                Recalculate Score
              </button>
            </div>
          </div>

          {jobFit && (
            <div className="jobfit-banner">
              <div className="jobfit-banner__score" style={{ color: scoreColor(jobFit.matchScore) }}>
                {jobFit.matchScore.toFixed(0)}%
                <span>job match</span>
              </div>
              <div className="jobfit-banner__body">
                <p>{jobFit.message}</p>
                {jobFit.matched.length > 0 && (
                  <p className="jobfit-banner__kw">
                    <strong>Matched:</strong> {jobFit.matched.slice(0, 12).join(", ")}
                  </p>
                )}
                {jobFit.missing.length > 0 && (
                  <p className="jobfit-banner__kw jobfit-banner__kw--miss">
                    <strong>Missing:</strong> {jobFit.missing.slice(0, 12).join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="score__list">
            {report.sections.map((s) => {
              const isOpen = open === s.key;
              return (
                <div className={`score-row${isOpen ? " is-open" : ""}`} key={s.key}>
                  <div className="score-row__head">
                    <span className="score-row__icon" style={{ borderColor: scoreColor(s.score) }}>
                      {ICON_KEYS.has(s.key) ? <SectionIcon name={s.key as never} size={22} /> : null}
                    </span>
                    <span className="score-row__label">{s.label}</span>
                    <span className="score-row__score" style={{ color: scoreColor(s.score) }}>
                      {s.score.toFixed(0)} / 100
                    </span>
                    <span className="score-row__entry">Entry score: {s.entryScore.toFixed(2)}</span>
                    {isOpen && (
                      <button
                        className={`score-row__fix${fixing === s.key ? " is-active" : ""}`}
                        onClick={() => setFixing(fixing === s.key ? null : s.key)}
                      >
                        {fixing === s.key ? "Done" : "Fix now"}
                      </button>
                    )}
                    <button
                      className="score-row__toggle"
                      onClick={() => setOpen(isOpen ? null : s.key)}
                      aria-label={isOpen ? "Collapse" : "Expand"}
                    >
                      {isOpen ? <Minus /> : <Plus />}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="score-row__body">
                      {s.critical.length > 0 && (
                        <Group tone="critical" title="Critical mistakes" items={s.critical} />
                      )}
                      {s.suggestions.length > 0 && (
                        <Group tone="suggestion" title="Suggestions" items={s.suggestions} />
                      )}
                      {s.goodPractices.length > 0 && (
                        <Group tone="good" title="Good practices" items={s.goodPractices} />
                      )}
                      {fixing === s.key && (
                        <div className="score-row__fixform">
                          {renderSectionForm(s.key)}
                          <div className="score-row__fixactions">
                            <button className="topbtn topbtn--dark" onClick={() => { setFixing(null); void recalculate(); }}>
                              Save & recalculate
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Group({
  tone,
  title,
  items,
}: {
  tone: "critical" | "suggestion" | "good";
  title: string;
  items: string[];
}) {
  const badgeIcon =
    tone === "good" ? <Check size={12} /> : tone === "suggestion" ? <LightbulbBadge size={12} /> : <Warn size={12} />;

  return (
    <div className="score-group">
      <span className={`score-group__badge score-group__badge--${tone}`}>
        {badgeIcon} {title}
      </span>
      <ol className="score-group__list">
        {items.map((it, i) => (
          <li key={i}>
            <span className="score-group__num">({i + 1})</span> {it}
          </li>
        ))}
      </ol>
    </div>
  );
}
