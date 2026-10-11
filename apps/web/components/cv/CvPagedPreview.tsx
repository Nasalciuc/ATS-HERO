"use client";
// Paged CV preview for the "Complete" pop-up (Figma 311:3326): one A4 page at a time, the arrows
// and "Page 1 / 2" around it. It renders the same PDF the download produces (renderCvPdfBlob),
// so preview == export, but draws it on a canvas with PDF.js instead of the browser's PDF viewer
// (an iframe with its own chrome, blank in some browsers). PDF.js runs in-thread: importing its
// worker module sets globalThis.pdfjsWorker, so no worker URL — and no CSP change — is needed.
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderCvPdfBlob } from "@/lib/exportPdf";
import { ArrowUp } from "@/components/figma-icons";
import type { CvData } from "@/lib/types";

const PAGE_W = 387; // Figma: a 389×552 frame with a 1px border around an A4 page

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // @ts-expect-error — the worker bundle ships without type declarations
  await import("pdfjs-dist/build/pdf.worker.min.mjs");
  return pdfjs;
}

export function CvPagedPreview({ data, templateId, accent }: { data: CvData; templateId: string; accent: number | string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  // (Re)build the PDF when the CV, template or colour changes.
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setState("loading");
    (async () => {
      try {
        const [pdfjs, blob] = await Promise.all([loadPdfjs(), renderCvPdfBlob(data, templateId, accent)]);
        loaded = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
        if (cancelled) return void loaded.destroy();
        setDoc(loaded); // the [doc] effect below destroys the previous document
        setPage((p) => Math.min(p, loaded!.numPages));
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, templateId, accent]);

  useEffect(() => () => void doc?.destroy(), [doc]); // free the previous document's memory

  // Draw the current page, sharp on high-DPI screens.
  useEffect(() => {
    if (!doc || !canvasRef.current) return;
    let task: { cancel: () => void } | null = null;
    let stale = false;
    (async () => {
      const p = await doc.getPage(page);
      if (stale || !canvasRef.current) return;
      const base = p.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const viewport = p.getViewport({ scale: (PAGE_W / base.width) * dpr });
      const canvas = canvasRef.current;
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const render = p.render({ canvasContext: ctx, viewport });
      task = render;
      await render.promise.catch(() => undefined);
    })();
    return () => {
      stale = true;
      task?.cancel();
    };
  }, [doc, page]);

  const pages = doc?.numPages ?? 1;
  return (
    <div className="cvpages" data-figma="cv-preview">
      <button
        type="button"
        className="cvpages__arrow"
        data-figma="cv-prev"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => setPage((p) => Math.max(1, p - 1))}
      >
        <ArrowUp size={26} style={{ transform: "rotate(-90deg)" }} />
      </button>
      <div className="cvpages__col">
        <div className="cvpages__page" data-figma="cv-page" aria-busy={state === "loading"}>
          <canvas ref={canvasRef} className="cvpages__canvas" aria-label={`CV preview, page ${page} of ${pages}`} role="img" />
          {state === "error" && <p className="cvpages__error">The preview couldn’t be drawn — your downloads still work.</p>}
        </div>
        <p className="cvpages__count" data-figma="cv-page-count">
          Page <span>{page}</span>
          <span>/</span>
          <span>{pages}</span>
        </p>
      </div>
      <button
        type="button"
        className="cvpages__arrow"
        data-figma="cv-next"
        aria-label="Next page"
        disabled={page >= pages}
        onClick={() => setPage((p) => Math.min(pages, p + 1))}
      >
        <ArrowUp size={26} style={{ transform: "rotate(90deg)" }} />
      </button>
    </div>
  );
}
