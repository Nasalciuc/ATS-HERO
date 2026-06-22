import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import { Save, ArrowRight, Upload } from "../components/icons";
import { api } from "../lib/api";

type Mode = "improve" | "jobfit";

const ANALYZE_STEPS = ["Adding CV", "ATS-Analysis", "Improvement"];

function StepDots() {
  return (
    <div className="analyze-steps">
      {ANALYZE_STEPS.map((label, i) => (
        <div className="analyze-step" key={label}>
          {i > 0 && <span className="analyze-step__line" />}
          <span className={`analyze-step__node${i === 0 ? " is-current" : ""}`} />
          <span className={`analyze-step__label${i === 0 ? " is-current" : ""}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function TextOrUpload({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    onChange(text);
  };

  return (
    <div className="analyze-block">
      <label className="field__label">INSERT TEXT</label>
      <textarea
        className="analyze-textarea"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="analyze-or">or</div>
      <button className="field__upload" onClick={() => fileRef.current?.click()}>
        <Upload size={16} /> Upload file
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.json,.csv"
        hidden
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}

export default function AnalyzePage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [cvText, setCvText] = useState("");
  const [jobText, setJobText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = mode === "improve" ? "Add your CV" : "Add your CV and job description";
  const active = mode === "improve" ? "improve" : "jobfit";

  const run = async () => {
    setError(null);
    if (!cvText.trim()) {
      setError("Please paste or upload your CV first.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "jobfit") {
        if (!jobText.trim()) {
          setError("Add a job description to check the match.");
          setBusy(false);
          return;
        }
        const [{ report }, fit] = await Promise.all([
          api.score({ text: cvText }),
          api.jobfit(cvText, jobText),
        ]);
        sessionStorage.setItem("ats_report", JSON.stringify(report));
        sessionStorage.setItem("ats_jobfit", JSON.stringify(fit.report));
      } else {
        const { report } = await api.score({ text: cvText });
        sessionStorage.setItem("ats_report", JSON.stringify(report));
        sessionStorage.removeItem("ats_jobfit");
      }
      navigate("/app/score");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title={title}
      active={active}
      actions={
        <button className="topbtn topbtn--dark">
          <Save size={18} /> Save
        </button>
      }
    >
      <StepDots />

      <div className="analyze-panel">
        <TextOrUpload value={cvText} onChange={setCvText} placeholder="Paste your CV text here…" />
        {mode === "jobfit" && (
          <TextOrUpload value={jobText} onChange={setJobText} placeholder="Paste the job description here…" />
        )}
      </div>

      {error && <p className="analyze-error">{error}</p>}

      <div className="analyze-footer">
        <button className="topbtn topbtn--dark" onClick={run} disabled={busy}>
          {busy ? "Analyzing…" : "Check ATS Score"} <ArrowRight size={18} />
        </button>
      </div>
    </AppShell>
  );
}
