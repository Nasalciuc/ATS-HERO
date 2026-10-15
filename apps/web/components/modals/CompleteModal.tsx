"use client";
import dynamic from "next/dynamic";
import { useState, type KeyboardEvent } from "react";
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
 * WAI-ARIA radio group keys: the group is one Tab stop (the checked option), arrows/Home/End move
 * the choice and the focus together.
 */
function radioKeys<T>(e: KeyboardEvent<HTMLElement>, values: T[], current: T, choose: (v: T) => void) {
  const i = Math.max(0, values.indexOf(current));
  const last = values.length - 1;
  const to =
    e.key === "ArrowDown" || e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
    : e.key === "ArrowUp" || e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
    : e.key === "Home" ? 0
    : e.key === "End" ? last
    : -1;
  if (to < 0) return;
  e.preventDefault();
  choose(values[to]);
  e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
}

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
  const [failed, setFailed] = useState<"pdf" | "doc" | null>(null);

  // Debounce so the PDF isn't rebuilt on every keystroke behind the pop-up.
  const previewData = useDebouncedValue(data, 500);

  const download = async (kind: "pdf" | "doc") => {
    setBusy(kind);
    setFailed(null);
    try {
      if (kind === "pdf") await downloadCvPdf(data, templateId, accent);
      else await downloadCvDocx(data, accent);
    } catch (err) {
      console.error(err);
      setFailed(kind);
    } finally {
      setBusy(null);
    }
  };

  const accentValues = TOKENS.primaries.map((_, i) => i + 1);

  return (
    <Modal open={open} onClose={onClose} variant="center" panelClassName="modal__panel--complete">
      <div className="complete">
        <div className="complete__side">
          <h2 className="complete__title" data-figma="complete-title">Customise your CV</h2>
          <div
            className="complete__styles"
            role="radiogroup"
            aria-label="Style"
            data-figma="complete-styles"
            onKeyDown={(e) => radioKeys(e, TEMPLATES.map((t) => t.id), templateId, setTemplate)}
          >
            {TEMPLATES.map((t) => {
              const on = t.id === templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  tabIndex={on ? 0 : -1}
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
          <div
            className="complete__accents"
            role="radiogroup"
            aria-label="Colour"
            onKeyDown={(e) => radioKeys(e, accentValues, typeof accent === "number" ? accent : 1, setAccent)}
          >
            {TOKENS.primaries.map((color, i) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={accent === i + 1}
                // one Tab stop: the chosen colour (the first one when a custom hex is set)
                tabIndex={accent === i + 1 || (typeof accent !== "number" && i === 0) ? 0 : -1}
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
            <button
              type="button"
              className="download-btn"
              data-figma="download-doc"
              title="Word document (.docx)"
              disabled={busy !== null}
              onClick={() => void download("doc")}
            >
              {/* f7:doc cropped to the Figma 13×17 vector */}
              <DocFileIcon width={13} height={17} viewBox="8.275 2.875 39.45 50.25" preserveAspectRatio="none" />
              {busy === "doc" ? "Preparing…" : "Download DOC"}
            </button>
          </div>
          {failed && (
            <p className="complete__error" role="alert">
              The {failed === "pdf" ? "PDF" : "Word file"} couldn’t be created. Please try again.
            </p>
          )}
        </div>

        <button type="button" className="topbtn topbtn--dark complete__score" data-figma="complete-score" onClick={onScore}>
          <GaugeIcon /> ATS-score
        </button>
      </div>
    </Modal>
  );
}
