"use client";
// Export controls — both formats, with the UX hint from the debate. PDF for humans /
// design fidelity; Word (.docx) for online ATS portals. No paywall on either.
import { downloadCvPdf } from "@/lib/exportPdf";
import { downloadCvDocx } from "@/lib/exportDocx";
import { useBuilderStore } from "@/stores/cv-builder-store";
import type { CvData } from "@/lib/types";

export function ExportButtons({ data }: { data: CvData }) {
  const templateId = useBuilderStore((s) => s.templateId);
  const accent = useBuilderStore((s) => s.accent);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => downloadCvPdf(data, templateId, accent)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={() => downloadCvDocx(data, accent)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Download Word
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        PDF keeps your design — best for sending directly to a recruiter. Word (.docx) is the
        safest for online application portals (ATS), especially older ones.
      </p>
    </div>
  );
}
