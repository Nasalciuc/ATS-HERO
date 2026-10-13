"use client";
import { useId, useRef, useState, useEffect } from "react";
import { useNavigate } from "@/lib/router";
import AppShell from "../components/app/AppShell";
import AnalyzeSteps from "../components/app/AnalyzeSteps";
import { ArrowUp, SaveDisk, UploadRounded } from "../components/figma-icons";
import { api } from "../lib/api";
import { isPdfFile } from "../lib/pdf";
import { guardAndExtractPdf, GUARD_MSG } from "../lib/pdf-guard";

type Mode = "improve" | "jobfit";

/** Figma "Frame 347": INSERT TEXT (778×134) · "or" · Upload file — 16 apart. */
function TextOrUpload({
  value,
  onChange,
  placeholder,
  figma,
  what,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  figma: string;
  /** read out after the visible label, so the two Job Fit fields don't share one name */
  what: string;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setParsing(true);
    setUploadError(null);
    try {
      if (isPdfFile(file)) {
        const res = await guardAndExtractPdf(file);
        if (!res.ok) {
          setUploadError(GUARD_MSG[res.error]);
          return;
        }
        onChange(res.text);
        return;
      }
      onChange(await file.text());
    } catch {
      setUploadError(GUARD_MSG.PARSE_FAILED);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="analyze-block" data-figma={figma}>
      <div className="analyze-field" data-figma={`${figma}-field`}>
        <label className="field__label" htmlFor={id}>
          INSERT TEXT<span className="sr-only">: {what}</span>
        </label>
        <textarea
          id={id}
          className="analyze-textarea"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p className="analyze-or" data-figma={`${figma}-or`}>
        or
      </p>
      <button
        type="button"
        className="field__upload analyze-upload"
        data-figma={`${figma}-upload`}
        onClick={() => fileRef.current?.click()}
        disabled={parsing}
      >
        {/* the same flattened 16×15 upload glyph as the builder's photo button */}
        <UploadRounded width={16} height={15} viewBox="4 4.425 16 15.575" preserveAspectRatio="none" />{" "}
        {parsing ? "Extracting…" : "Upload file"}
        <span className="sr-only"> ({what})</span>
      </button>
      {uploadError && (
        <p className="analyze-error" role="alert">
          {uploadError}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.json,.csv,.pdf"
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

  useEffect(() => {
    const draftCv = sessionStorage.getItem(`ats_${mode}_cv`);
    const draftJob = sessionStorage.getItem("ats_jobfit_jd");
    if (draftCv) setCvText(draftCv);
    if (mode === "jobfit" && draftJob) setJobText(draftJob);
  }, [mode]);

  const saveDraft = () => {
    sessionStorage.setItem(`ats_${mode}_cv`, cvText);
    if (mode === "jobfit") sessionStorage.setItem("ats_jobfit_jd", jobText);
  };

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
        sessionStorage.setItem("ats_flow", "jobfit");
        const [{ report }, fit] = await Promise.all([
          api.score({ text: cvText }),
          api.jobfit(cvText, jobText),
        ]);
        sessionStorage.setItem("ats_report", JSON.stringify(report));
        sessionStorage.setItem("ats_jobfit", JSON.stringify(fit.report));
        // kept for "Recalculate Score" on the results page
        sessionStorage.setItem("ats_text", cvText);
        sessionStorage.setItem("ats_jd", jobText);
      } else {
        sessionStorage.setItem("ats_flow", "improve");
        const { report } = await api.score({ text: cvText });
        sessionStorage.setItem("ats_report", JSON.stringify(report));
        sessionStorage.removeItem("ats_jobfit");
        sessionStorage.setItem("ats_text", cvText);
        sessionStorage.removeItem("ats_jd");
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
      variant="analyze"
      actions={
        <button className="topbtn topbtn--title topbtn--dark" data-figma="btn-save" onClick={saveDraft}>
          <SaveDisk /> <span className="topbtn__label">Save</span>
        </button>
      }
    >
      <AnalyzeSteps current={0} />

      <div className={`analyze-card${mode === "jobfit" ? " analyze-card--two" : ""}`} data-figma="analyze-card">
        <TextOrUpload figma="analyze-cv" what="your CV" value={cvText} onChange={setCvText} placeholder="Paste your CV text here…" />
        {mode === "jobfit" && (
          <TextOrUpload
            figma="analyze-job"
            what="the job description"
            value={jobText}
            onChange={setJobText}
            placeholder="Paste the job description here…"
          />
        )}
      </div>

      {error && (
        <p className="analyze-error" role="alert">
          {error}
        </p>
      )}

      <div className="analyze-footer">
        <button className="topbtn topbtn--dark analyze-check" data-figma="btn-check" onClick={run} disabled={busy}>
          {busy ? "Analyzing…" : "Check ATS Score"} <ArrowUp className="topbtn__arrow--right" />
        </button>
      </div>
    </AppShell>
  );
}
