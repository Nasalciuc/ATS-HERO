import { useState } from "react";
import Modal from "../ui/Modal";
import CvDocument from "../cv/CvDocument";
import { ArrowLeft, ArrowRight, RadioDot } from "../icons";
import type { CvData } from "../../lib/types";

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
  const [style, setStyle] = useState(1);

  const download = (format: "pdf" | "doc") => {
    // Demo export: serialize the rendered CV as a downloadable HTML/text file.
    const text = serializeCv(data);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(data.personalInfo.name || "resume").replace(/\s+/g, "_")}.${format === "pdf" ? "txt" : "doc"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal open={open} onClose={onClose} variant="center" width={900}>
      <div className="complete">
        <div className="complete__side">
          <h2 className="complete__title">Customise your CV</h2>
          <div className="complete__styles">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <button key={s} className="complete__style" onClick={() => setStyle(s)}>
                <span className={style === s ? "is-checked" : ""}>
                  <RadioDot checked={style === s} size={20} />
                </span>
                Style {s}
              </button>
            ))}
          </div>
        </div>

        <div className="complete__preview-wrap">
          <button className="complete__score" onClick={onScore}>
            ⌾ ATS-score
          </button>
          <div className="complete__nav">
            <button className="tnav-btn tnav-btn--muted"><ArrowLeft /></button>
            <button className="tnav-btn"><ArrowRight /></button>
          </div>
          <div className="complete__preview">
            <CvDocument data={data} styleId={style} />
          </div>
          <div className="complete__page">Page 1 / 1</div>
          <div className="complete__downloads">
            <button className="btn btn--outline-dark" onClick={() => download("pdf")}>
              ⬇ Download PDF
            </button>
            <button className="btn btn--outline-dark" onClick={() => download("doc")}>
              ⬇ Download DOC
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function serializeCv(data: CvData): string {
  const lines: string[] = [];
  const p = data.personalInfo;
  lines.push(p.name, data.summary.position, "");
  lines.push([p.email, p.phone, p.linkedin, p.website].filter(Boolean).join(" | "), "");
  if (data.summary.valueProposition) lines.push("SUMMARY", data.summary.valueProposition, "");
  if (data.skills.length) lines.push("SKILLS", data.skills.join(", "), "");
  if (data.work.length) {
    lines.push("EXPERIENCE");
    for (const w of data.work)
      lines.push(`${w.role}, ${w.company} (${w.startDate} – ${w.current ? "Present" : w.endDate})`, w.description, "");
  }
  if (data.education.length) {
    lines.push("EDUCATION");
    for (const e of data.education) lines.push(`${e.degree}, ${e.institution}`, e.additional, "");
  }
  return lines.filter((l) => l !== undefined).join("\n");
}
