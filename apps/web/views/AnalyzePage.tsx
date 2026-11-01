"use client";
import { useId, useRef, useState, useEffect } from "react";
import { useNavigate } from "@/lib/router";
import AppShell from "../components/app/AppShell";
import AnalyzeSteps from "../components/app/AnalyzeSteps";
import { ArrowUp, SaveDisk, UploadRounded } from "../components/figma-icons";
import { api } from "../lib/api";
import { startImprove } from "../lib/analyze-flow";
import { CV_FILE_ACCEPT, CV_FILE_MSG, droppedFile, isFileDrag, readCvFile } from "../lib/cv-file";
import type { AtsRead } from "../lib/ats-read/types";

type Mode = "improve" | "jobfit";

/** Figma "Frame 347": INSERT TEXT (778×134) · "or" · Upload file — 16 apart. */
function TextOrUpload({
  value,
  onChange,
  placeholder,
  figma,
  what,
  onFileRead,
}: {
  value: string;
  onChange: (v: string) => void;
  /** the uploaded file read for the ATS check, or null when the text didn't come from a file */
  onFileRead?: (ats: AtsRead | null) => void;
  placeholder: string;
  figma: string;
  /** read out after the visible label, so the two Job Fit fields don't share one name */
  what: string;
}) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [over, setOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // PDF, Word or text, read in the browser (lib/cv-file.ts); a scan, an old .doc or a picture
  // gets a message saying what to do instead of an empty field
  const onFile = async (file: File) => {
    setParsing(true);
    setUploadError(null);
    const res = await readCvFile(file);
    setParsing(false);
    if (res.ok) {
      onChange(res.text);
      onFileRead?.(res.ats ?? null);
    } else setUploadError(CV_FILE_MSG[res.error]);
  };

  return (
    <div
      className={`analyze-block${over ? " is-over" : ""}`}
      data-figma={figma}
      onDragOver={(e) => {
        if (!isFileDrag(e)) return; // dragged text still drops into the field as text
        e.preventDefault(); // without it the browser opens the dropped file instead of the site
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        const file = droppedFile(e);
        if (!file) return;
        e.preventDefault();
        setOver(false);
        void onFile(file);
      }}
    >
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
        accept={CV_FILE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // the browser fires no change for the same file twice otherwise
          if (file) void onFile(file);
        }}
      />
    </div>
  );
}

export default function AnalyzePage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const [cvText, setCvText] = useState("");
  // the uploaded CV read for the ATS check; the report uses it only while the text is still the file's
  const [cvFile, setCvFile] = useState<AtsRead | null>(null);
  const [jobText, setJobText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // a saved draft, else the text this flow last analysed (Back from the results)
    const analysed = sessionStorage.getItem("ats_flow") === mode;
    const draftCv = sessionStorage.getItem(`ats_${mode}_cv`) ?? (analysed ? sessionStorage.getItem("ats_text") : null);
    const draftJob = sessionStorage.getItem("ats_jobfit_jd") ?? (analysed ? sessionStorage.getItem("ats_jd") : null);
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
          api.score({ text: cvText, ats: cvFile }),
          api.jobfit(cvText, jobText),
        ]);
        sessionStorage.setItem("ats_report", JSON.stringify(report));
        sessionStorage.setItem("ats_jobfit", JSON.stringify(fit.report));
        // kept for "Recalculate Score" on the results page; it replaces an older saved draft
        sessionStorage.setItem("ats_text", cvText);
        sessionStorage.setItem("ats_jd", jobText);
        sessionStorage.removeItem("ats_jobfit_cv");
        sessionStorage.removeItem("ats_jobfit_jd");
      } else {
        startImprove(cvText, cvFile);
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
        <TextOrUpload
          figma="analyze-cv"
          what="your CV"
          value={cvText}
          onChange={setCvText}
          onFileRead={setCvFile}
          placeholder="Paste your CV text here…"
        />
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
