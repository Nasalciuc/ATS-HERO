import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import { Eye, Save, Plus, Minus, Warn, Check } from "../components/icons";
import { useApp } from "../store/AppContext";
import { api } from "../lib/api";
import type { JobFitReport, ScoreReport, SectionKey } from "../lib/types";

const SECTION_EMOJI: Record<SectionKey, string> = {
  personalInfo: "🪪",
  education: "🎓",
  work: "💼",
  summary: "📝",
  skills: "💪",
  awards: "🏆",
  certifications: "📜",
  publications: "📚",
  volunteering: "🤝",
  activities: "🚀",
};

function scoreColor(score: number): string {
  if (score >= 80) return "var(--green)";
  if (score >= 50) return "#E8A91D";
  return "var(--red)";
}

export default function ScorePage() {
  const { data, save, saving } = useApp();
  const navigate = useNavigate();
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [jobFit, setJobFit] = useState<JobFitReport | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const compute = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    void compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recalculate = async () => {
    sessionStorage.removeItem("ats_report");
    sessionStorage.removeItem("ats_jobfit");
    setJobFit(null);
    const { report: fresh } = await api.score({ data });
    setReport(fresh);
    setOpen(fresh.sections[0]?.key ?? null);
  };

  return (
    <AppShell
      title="ATS Score Results"
      active="create"
      actions={
        <>
          <button className="topbtn topbtn--ghost" onClick={() => navigate("/app/create")}>
            <Eye size={18} /> Preview
          </button>
          <button className="topbtn topbtn--dark" onClick={() => void save()}>
            <Save size={18} /> {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {loading || !report ? (
        <div className="score-loading">
          <div className="score-spinner" />
          <p>Analyzing your resume…</p>
        </div>
      ) : (
        <div className="score">
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
                      {SECTION_EMOJI[s.key]}
                    </span>
                    <span className="score-row__label">{s.label}</span>
                    <span className="score-row__score" style={{ color: scoreColor(s.score) }}>
                      {s.score.toFixed(0)} / 100
                    </span>
                    <span className="score-row__entry">Entry score: {s.entryScore.toFixed(2)}</span>
                    {isOpen && <button className="score-row__fix">Fix now</button>}
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
  return (
    <div className="score-group">
      <span className={`score-group__badge score-group__badge--${tone}`}>
        {tone === "good" ? <Check size={12} /> : <Warn size={12} />} {title}
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
