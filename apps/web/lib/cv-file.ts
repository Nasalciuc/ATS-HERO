/**
 * Reads a CV (or a job description) the user picked or dropped, inside the browser: the file
 * never leaves the device. PDF (its text layer), Word .docx and plain text. Every upload in the
 * app goes through here: the landing card, Improve My Resume and Check Job Fit.
 *
 * The file type is told by its first bytes, not its name: a PDF renamed .txt is still read as a
 * PDF, and an old .doc renamed .docx gets the right advice.
 */
import type { AtsRead } from "./ats-read/types";

export type CvFileError =
  | "TOO_LARGE"
  | "TOO_MANY_PAGES"
  | "SCANNED"
  | "OLD_WORD"
  | "NOT_SUPPORTED"
  | "PARSE_FAILED"
  | "EMPTY";

export type CvFileResult =
  /** `ats`: the file read the ways ATS readers do (lib/ats-read), for the ATS check; not for text files */
  | { ok: true; text: string; kind: "pdf" | "docx" | "text"; ats?: AtsRead }
  | { ok: false; error: CvFileError };

export const MAX_CV_FILE_BYTES = 10 * 1024 * 1024;

/** What the file pickers offer. Anything else can still be chosen with "All files". */
export const CV_FILE_ACCEPT = ".pdf,.docx,.txt,.md,.json,.csv";

export const CV_FILE_MSG: Record<CvFileError, string> = {
  TOO_LARGE: "This file is over 10 MB.",
  TOO_MANY_PAGES: "This PDF has more than 50 pages.",
  SCANNED:
    "We found no text in this PDF. It is probably a scan or a picture, and an ATS can’t read it either. Upload the PDF your editor saved, a Word file, or paste the text.",
  OLD_WORD: "This is an old Word file (.doc). Open it in Word, save it as .docx or PDF and upload that.",
  NOT_SUPPORTED: "Upload a PDF, a Word file (.docx) or a text file.",
  PARSE_FAILED: "We couldn’t read this file. Save it again as PDF or .docx, or paste the text.",
  EMPTY: "This file has no text in it.",
};

const TEXT_NAME = /\.(txt|md|json|csv)$/i;
/** Fewer letters and digits than this in a whole PDF: there is no text layer to speak of. */
const MIN_TEXT_CHARS = 30;

const startsWith = (head: Uint8Array, bytes: number[]) => bytes.every((b, i) => head[i] === b);

export async function readCvFile(file: File): Promise<CvFileResult> {
  if (file.size > MAX_CV_FILE_BYTES) return { ok: false, error: "TOO_LARGE" };
  if (file.size === 0) return { ok: false, error: "EMPTY" };
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  try {
    if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
      // %PDF-: read once, the ways ATS readers do; the text is the in-order reading, as before
      const { readPdf } = await import("./ats-read/pdf");
      const { MAX_PDF_PAGES } = await import("./pdf");
      const ats = await readPdf(await file.arrayBuffer());
      if ((ats.pages ?? 0) > MAX_PDF_PAGES) return { ok: false, error: "TOO_MANY_PAGES" };
      const text = ats.readings.find((r) => r.reader === "pdf-stream")?.text ?? "";
      if (text.replace(/[^\p{L}\p{N}]/gu, "").length < MIN_TEXT_CHARS) return { ok: false, error: "SCANNED" };
      return { ok: true, text, kind: "pdf", ats };
    }
    if (startsWith(head, [0x50, 0x4b, 0x03, 0x04])) {
      // PK: a zip, which a .docx is (so are .xlsx, .pptx and .odt)
      const { readDocx } = await import("./ats-read/docx");
      const ats = await readDocx(await file.arrayBuffer());
      if (ats === null) return { ok: false, error: "NOT_SUPPORTED" };
      const text = ats.readings.find((r) => r.reader === "docx-all")?.text ?? "";
      return text.trim() ? { ok: true, text, kind: "docx", ats } : { ok: false, error: "EMPTY" };
    }
    if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
      // the old Office binary format: .doc (or .xls, .ppt)
      return { ok: false, error: /\.(xls|ppt)$/i.test(file.name) ? "NOT_SUPPORTED" : "OLD_WORD" };
    }
    if (TEXT_NAME.test(file.name) || file.type.startsWith("text/")) {
      const text = await file.text();
      // a NUL byte: binary content with a text name, which would land in the field as gibberish
      if (text.includes("\u0000")) return { ok: false, error: "NOT_SUPPORTED" };
      return text.trim() ? { ok: true, text, kind: "text" } : { ok: false, error: "EMPTY" };
    }
    return { ok: false, error: "NOT_SUPPORTED" };
  } catch {
    return { ok: false, error: "PARSE_FAILED" };
  }
}

/** The first file of a drop, when it carries files (not dragged text or a link). */
export function droppedFile(e: { dataTransfer: DataTransfer | null }): File | null {
  const files = e.dataTransfer?.files;
  return files && files.length > 0 ? files[0] : null;
}

/** True while something with files is dragged over: the drop zone lights up only for files. */
export function isFileDrag(e: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}
