"use client";
// ATS read check — runs the EXACT files the user is about to download (the selected PDF
// template + the Word export) through the ATS lab readers (POST /parse-check, apps/ai) with the
// CvData as ground truth, and shows what an ATS recovers. Behind NEXT_PUBLIC_ATS_CHECK_ENABLED
// until apps/ai is deployed behind the server proxy (ROUND3 §1); off = renders nothing.
import { useEffect, useState } from "react";
import { parseCheck } from "@/lib/analyzer/python-client";
import type { ParseCheckReader, ParseCheckResult, ParseCheckVerdict } from "@/lib/analyzer/types";
import { renderCvPdfBlob } from "@/lib/exportPdf";
import { downloadCvDocx, renderCvDocxBlob } from "@/lib/exportDocx";
import { printableCv } from "@/lib/cv-print";
import { getTemplate } from "@/components/cv/templates";
import { useBuilderStore } from "@/stores/cv-builder-store";
import type { CvData } from "@/lib/types";

const ENABLED = process.env.NEXT_PUBLIC_ATS_CHECK_ENABLED === "true";
const TONE: Record<ParseCheckVerdict, string> = { PASS: "text-emerald-700", WARN: "text-amber-700", FAIL: "text-red-700" };
const ICON: Record<ParseCheckVerdict, string> = { PASS: "✓", WARN: "!", FAIL: "✕" };

type Row = { label: string; result: ParseCheckResult };

export function AtsReadCheck({ data }: { data: CvData }) {
  const templateId = useBuilderStore((s) => s.templateId);
  const accent = useBuilderStore((s) => s.accent);
  const setTemplate = useBuilderStore((s) => s.setTemplate);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [state, setState] = useState<"idle" | "running" | "error">("idle");

  // A result must always describe what is on screen: any change invalidates it.
  useEffect(() => setRows(null), [templateId, accent, data]);

  if (!ENABLED) return null;

  async function run() {
    setState("running");
    try {
      const truth = printableCv(data);
      const [pdfBlob, docxBlob] = await Promise.all([renderCvPdfBlob(data, templateId, accent), renderCvDocxBlob(data, accent)]);
      const [pdf, docx] = await Promise.all([parseCheck(pdfBlob, "cv.pdf", truth), parseCheck(docxBlob, "cv.docx", truth)]);
      setRows([
        { label: `PDF · ${getTemplate(templateId).name}`, result: pdf },
        { label: "Word (.docx)", result: docx },
      ]);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const pdfRow = rows?.[0];
  const docxRow = rows?.[1];

  return (
    <div className="mt-4 rounded-xl border border-solid border-zinc-200 p-3 text-sm" data-testid="ats-read-check">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-zinc-900">ATS read check</div>
          <div className="text-xs text-zinc-500">Runs your exact files through the text readers ATS parsers rely on.</div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={state === "running"}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {state === "running" ? "Checking…" : rows ? "Re-check" : "Check"}
        </button>
      </div>

      {templateId === "modern" ? (
        <p className="mt-2 text-xs text-amber-700">
          Two-column design — great for emailing a recruiter. For online application portals, use Classic or the
          Word file: some ATS readers mix the two columns.
        </p>
      ) : null}

      {state === "error" ? (
        <p className="mt-2 text-xs text-red-700">The ATS check is unavailable right now — your downloads still work.</p>
      ) : null}

      {rows?.map(({ label, result }) => (
        <div key={label} className="mt-3">
          <div className={`font-medium ${TONE[result.summary.verdict]}`}>
            {ICON[result.summary.verdict]} {label}: read correctly by {result.summary.readers_passing ?? 0}/
            {result.summary.readers_total} ATS readers
          </div>
          {result.recommendations.map((r) => (
            <p key={r.code} className="mt-1 text-xs text-zinc-600">
              {r.message}
            </p>
          ))}
        </div>
      ))}

      {pdfRow && pdfRow.result.summary.verdict !== "PASS" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {templateId === "modern" ? (
            <button
              type="button"
              onClick={() => setTemplate("classic")}
              className="rounded-lg border border-solid border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Switch to Classic
            </button>
          ) : null}
          {docxRow?.result.summary.verdict === "PASS" ? (
            <button
              type="button"
              onClick={() => downloadCvDocx(data, accent)}
              className="rounded-lg border border-solid border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Download Word for online portals
            </button>
          ) : null}
        </div>
      ) : null}

      {pdfRow ? <WhatTheAtsSees reader={weakest(pdfRow.result.readers)} /> : null}
    </div>
  );
}

function weakest(readers: ParseCheckReader[]): ParseCheckReader | undefined {
  return [...readers].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
}

function WhatTheAtsSees({ reader }: { reader?: ParseCheckReader }) {
  if (!reader) return null;
  const missing = "— not found";
  return (
    <details className="mt-3 text-xs text-zinc-600">
      <summary className="cursor-pointer text-zinc-800">What the weakest ATS reader sees ({reader.reader})</summary>
      <dl className="mt-2 grid grid-cols-[96px_1fr] gap-x-2 gap-y-1">
        <dt className="text-zinc-500">Name</dt>
        <dd>{reader.name ?? missing}</dd>
        <dt className="text-zinc-500">Email</dt>
        <dd>{reader.email ?? missing}</dd>
        <dt className="text-zinc-500">Phone</dt>
        <dd>{reader.phone ?? missing}</dd>
        <dt className="text-zinc-500">Jobs</dt>
        <dd>
          {reader.jobs?.length
            ? reader.jobs.map((j) => `${j.text.split("\n")[0]} (${j.start} – ${j.end})`).join(" · ")
            : "— none segmented"}
        </dd>
        <dt className="text-zinc-500">Skills</dt>
        <dd>{reader.skills?.length ?? 0} read as a list</dd>
      </dl>
      {reader.problems?.length ? (
        <ul className="mt-2 list-disc pl-4">
          {reader.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
