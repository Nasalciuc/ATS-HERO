"use client";
import { useId, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { CV_FILE_ACCEPT, CV_FILE_MSG, droppedFile, isFileDrag, readCvFile } from "@/lib/cv-file";
import { startImprove } from "@/lib/analyze-flow";
import { GaugeIcon, StepIcon, UploadRounded, UserRoundIcon } from "./figma-icons";

const features = [
  {
    Icon: StepIcon,
    size: 40,
    title: "Guidance at every step",
    body: "Fill in your CV using a clear, guided structure, use role-specific examples, and receive tips and real-time recommendations to improve your content.",
  },
  {
    Icon: GaugeIcon,
    size: 43,
    title: "In-depth analysis",
    body: "The system evaluates your CV like a recruiter and ATS, providing insights, prioritized recommendations, and explanations while highlighting strengths and areas for improvement.",
  },
  {
    Icon: UserRoundIcon,
    size: 41,
    title: "Personalized approach",
    // "import or export PDF/DOC files" promised an import the builder does not have
    body: "Use flexible sections and blocks tailored to your needs, customize your CV for different roles in minutes, and download it as PDF or Word easily.",
  },
];

/**
 * "Check your resume ATS score now": click or drop a CV and the Improve analysis runs on it, the
 * same as /app/improve. The file is read in the browser (lib/cv-file.ts). It used to be a drawing
 * of an upload box that did nothing.
 */
function UploadCard() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setError(null);
    setReading(true);
    const res = await readCvFile(file);
    if (!res.ok) {
      setError(CV_FILE_MSG[res.error]);
      setReading(false);
      return;
    }
    startImprove(res.text);
    navigate("/app/score");
  };

  return (
    <div
      className="upload-card"
      data-figma="features-upload"
      onDragOver={(e) => {
        if (!isFileDrag(e)) return;
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
      <h3 className="upload-card__title" data-figma="features-upload-title">Check your resume ATS score now</h3>
      <button
        type="button"
        className={`upload-card__drop${over ? " is-over" : ""}`}
        data-figma="features-drop"
        onClick={() => input.current?.click()}
        disabled={reading}
        aria-describedby={error ? errorId : undefined}
      >
        <UploadRounded size={42} />
        <span className="upload-card__hint">{reading ? "Reading your CV…" : "Upload a file in PDF or Word format"}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={CV_FILE_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // so picking the same file again still counts
          if (file) void onFile(file);
        }}
      />
      {error && (
        <p className="upload-card__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Features() {
  return (
    <section className="features" data-figma="features">
      <div className="container features__grid">
        <div>
          <h2 className="features__title" data-figma="features-title">
            We have everything you need to pass the first screening
          </h2>
          <UploadCard />
        </div>

        <div className="feature-list">
          {features.map(({ Icon, size, title, body }, i) => (
            <div className="feature" key={title} data-figma={`feature-${i}`}>
              <div className="feature__icon" data-figma={`feature-${i}-icon`}>
                {/* glyph sizes of the flattened Figma icons (33×33, 40×36, 30×34) */}
                <Icon size={size} />
              </div>
              <div>
                <h3 className="feature__title" data-figma={`feature-${i}-title`}>
                  {title}
                </h3>
                <p className="feature__body">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
