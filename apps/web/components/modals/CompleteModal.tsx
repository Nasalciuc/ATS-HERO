"use client";
import dynamic from "next/dynamic";
import Modal from "../ui/Modal";
import { TemplateSelector } from "../cv/TemplateSelector";
import { AccentPicker } from "../cv/AccentPicker";
import { ExportButtons } from "../cv/ExportButtons";
import { useBuilderStore } from "@/stores/cv-builder-store";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { CvData } from "../../lib/types";

// Live preview must be client-only — PDFViewer touches browser APIs.
const CvTemplatePreview = dynamic(
  () => import("../cv/CvTemplatePreview").then((m) => m.CvTemplatePreview),
  { ssr: false },
);

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
  const accent = useBuilderStore((s) => s.accent);

  // Debounce the preview data so PDFViewer doesn't re-render on every keystroke.
  const debouncedData = useDebouncedValue(data, 500);

  return (
    <Modal open={open} onClose={onClose} variant="center" width={900}>
      <div className="complete">
        <div className="complete__side">
          <h2 className="complete__title">Customise your CV</h2>
          {/* TODO(integration): these controls use Tailwind utility classes, but Tailwind is
              not yet wired in apps/web (tailwind.config.ts is a placeholder). They are fully
              functional; once Tailwind is configured they'll pick up their intended styling. */}
          <TemplateSelector />
          <div style={{ marginTop: 16 }}>
            <div className="complete__subtitle">Accent</div>
            <AccentPicker />
          </div>
        </div>

        <div className="complete__preview-wrap">
          <button className="complete__score" onClick={onScore}>
            ⌾ ATS-score
          </button>
          <div className="complete__preview" style={{ height: 760 }}>
            {open ? (
              <CvTemplatePreview data={debouncedData} templateId={templateId} accent={accent} />
            ) : null}
          </div>
          <div className="complete__downloads">
            <ExportButtons data={data} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
