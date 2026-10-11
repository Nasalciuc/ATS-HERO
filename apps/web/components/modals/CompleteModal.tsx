"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import Modal from "../ui/Modal";
import { AtsReadCheck } from "../cv/AtsReadCheck";
import { TEMPLATES } from "../cv/templates";
import { TOKENS } from "../cv/templates/theme";
import { DocFileIcon, GaugeIcon, PdfFileIcon } from "../figma-icons";
import { useBuilderStore } from "@/stores/cv-builder-store";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { downloadCvPdf } from "@/lib/exportPdf";
import { downloadCvDocx } from "@/lib/exportDocx";
import type { CvData } from "../../lib/types";

// Client-only: PDF rendering touches browser APIs.
const CvPagedPreview = dynamic(() => import("../cv/CvPagedPreview").then((m) => m.CvPagedPreview), { ssr: false });

const ACCENT_NAMES = ["Violet", "Teal", "Blue", "Green", "Rose", "Amber"];

/**
 * Figma "Pop-up_Complete" (311:3326): style list left, the CV one page at a time in the middle,
 * Download PDF / DOC under it, "ATS-score" top right. Not in Figma, kept on purpose: the accent
 * colours under the styles, and the ATS read check (only when NEXT_PUBLIC_ATS_CHECK_ENABLED).
 */
export default function CompleteModal({
  open,
  onClose,
  data,
  onScore,
}: {
  open: boolean;
  onClose: () => void;
  data: CvData;
  onScore: () => void;
}) {
  const templateId = useBuilderStore((s) => s.templateId);
  const setTemplate = useBuilderStore((s) => s.setTemplate);
  const accent = useBuilderStore((s) => s.accent);
  const setAccent = useBuilderStore((s) => s.setAccent);
  const [busy, setBusy] = useState<"pdf" | "doc" | null>(null);

  // Debounce so the PDF isn't rebuilt on every keystroke behind the pop-up.
  const previewData = useDebouncedValue(data, 500);

  const download = async (kind: "pdf" | "doc") => {
    setBusy(kind);
    try {
      if (kind === "pdf") await downloadCvPdf(data, templateId, accent);
      else await downloadCvDocx(data, accent);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} variant="center" panelClassName="modal__panel--complete">
      <div className="complete">
        <div className="complete__side">
          <h2 className="complete__title" data-figma="complete-title">Customise your CV</h2>
          <div className="complete__styles" role="radiogroup" aria-label="Style" data-figma="complete-styles">
            {TEMPLATES.map((t) => {
              const on = t.id === templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`style-radio${on ? " is-on" : ""}`}
                  title={t.description}
                  onClick={() => setTemplate(t.id)}
                >
                  <span className="style-radio__ring" aria-hidden="true" />
                  {t.name}
                </button>
              );
            })}
          </div>
          <div className="complete__accents" role="radiogroup" aria-label="Colour">
            {TOKENS.primaries.map((color, i) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={accent === i + 1}
                aria-label={ACCENT_NAMES[i]}
                title={ACCENT_NAMES[i]}
                className={`accent-dot${accent === i + 1 ? " is-on" : ""}`}
                style={{ background: color }}
                onClick={() => setAccent(i + 1)}
              />
            ))}
          </div>
          <AtsReadCheck data={data} />
        </div>

        <div className="complete__main">
          {open && <CvPagedPreview data={previewData} templateId={templateId} accent={accent} />}
          <div className="complete__downloads">
            <button type="button" className="download-btn" data-figma="download-pdf" disabled={busy !== null} onClick={() => void download("pdf")}>
              {/* proicons:pdf at its Figma size (15.4×18.5 group) */}
              <PdfFileIcon width={15.42} height={18.5} viewBox="4.275 2.75 15.45 18.5" overflow="visible" />
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </button>
            <button type="button" className="download-btn" data-figma="download-doc" disabled={busy !== null} onClick={() => void download("doc")}>
              {/* f7:doc cropped to the Figma 13×17 vector */}
              <DocFileIcon width={13} height={17} viewBox="8.275 2.875 39.45 50.25" preserveAspectRatio="none" />
              {busy === "doc" ? "Preparing…" : "Download DOC"}
            </button>
          </div>
        </div>

        <button type="button" className="topbtn topbtn--dark complete__score" data-figma="complete-score" onClick={onScore}>
          <GaugeIcon /> ATS-score
        </button>
      </div>
    </Modal>
  );
}
