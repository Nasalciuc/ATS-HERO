/**
 * What the ATS check reads from an uploaded CV file, in the browser (the file never leaves the
 * device). An ATS starts the same way: it pulls the text out of the file, then parses fields from
 * that text. Different readers pull different text from the same file, so the check keeps two
 * readings per format and the layout signals that explain where they differ.
 *
 * Design: `ATS-VIEW-DESIGN.md` (claude.ai Project "App Builder"), §1.6, §6 and §7.
 */

/**
 * The readings kept for one file.
 * - `pdf-stream`: the order the PDF stores its text (what `lib/pdf.ts` gives the app today; most
 *   ATS text extractors read this way).
 * - `pdf-rows`: the page read top to bottom, one printed row at a time (what layout-preserving
 *   extractors and OpenResume-style parsers do). A two-column page mixes its columns here.
 * - `docx-strict`: only the document body, without page headers, footers or text boxes (what the
 *   stricter readers keep; Greenhouse documents that contacts in a header or text box are lost).
 * - `docx-all`: everything Word shows, headers first (what `lib/docx-text.ts` gives the app today).
 */
export type AtsReaderId = "pdf-stream" | "pdf-rows" | "docx-strict" | "docx-all";

export interface AtsReading {
  reader: AtsReaderId;
  text: string;
}

/** A web link whose address is not printed anywhere on the page, e.g. the word "LinkedIn". */
export interface HiddenLink {
  url: string;
  /** the printed text the link sits on */
  label: string;
}

export interface AtsSignals {
  /** PDF: text in two columns side by side (a sidebar), which row-by-row readers mix. */
  twoColumns: boolean;
  /** PDF: web links whose address is not in the text, so a text reader never sees it. */
  hiddenLinks: HiddenLink[];
  /** PDF: words drawn with ligature glyphs (ﬁ, ﬂ…), which some readers keep, breaking searches. */
  ligatureWords: string[];
  /** Over 2.5 MB: Greenhouse documents that it doesn't parse files this large. */
  overSizeLimit: boolean;
  /** PDF: how many fonts the text uses. */
  fonts: number;
  /** DOCX: an email address or phone number that is only in a page header, footer or text box. */
  contactsOutsideBody: boolean;
  /** DOCX: tables in the document body. */
  tables: number;
  /** DOCX: text boxes. */
  textBoxes: number;
  /** DOCX: pictures. */
  images: number;
}

export interface AtsRead {
  kind: "pdf" | "docx";
  bytes: number;
  /** PDF only */
  pages: number | null;
  /** the program that made the PDF (its Producer, else its Creator), e.g. "Microsoft® Word" */
  producer: string | null;
  readings: AtsReading[];
  signals: AtsSignals;
}

/** Greenhouse Support, "Unsuccessful resume parse": files over 2.5 MB are not parsed. */
export const ATS_SIZE_LIMIT_BYTES = 2.5 * 1024 * 1024;

export const NO_SIGNALS: AtsSignals = {
  twoColumns: false,
  hiddenLinks: [],
  ligatureWords: [],
  overSizeLimit: false,
  fonts: 0,
  contactsOutsideBody: false,
  tables: 0,
  textBoxes: 0,
  images: 0,
};
