// Typed bridge from the Next.js app to the FastAPI service (apps/ai).
// Base URL from NEXT_PUBLIC_AI_URL (e.g. http://localhost:8000 in dev, the DO URL in prod).

import type {
  ScoreResult,
  ExtractResult,
  JobFitResult,
  FormatResult,
  RegionResult,
  RegionSignals,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8000";

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI service ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function postFile<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}${path}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`AI service ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Tier 2 NLP-enhanced ATS score of CV text. */
export const scoreText = (text: string) => postJSON<ScoreResult>("/score", { text });

/** Extract plain text from an uploaded DOCX/PDF (PyMuPDF). */
export const extractFile = (file: File) => postFile<ExtractResult>("/extract", file);

/** Keyword overlap between a CV and a job description ('mirror the JD'). */
export const jobFit = (cvText: string, jobText: string) =>
  postJSON<JobFitResult>("/job-fit", { cv_text: cvText, job_text: jobText });

/** Parseability analysis from the file structure. */
export const formatCheck = (file: File) => postFile<FormatResult>("/format", file);

/** Region-fit against a target country's norms (global). */
export const regionCheck = (target: string, signals: RegionSignals, cvText?: string) =>
  postJSON<RegionResult>("/region", { target, signals, cv_text: cvText ?? null });
