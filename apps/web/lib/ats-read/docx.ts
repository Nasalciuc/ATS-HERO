import JSZip from "jszip";
import { extractDocxText, wordXmlText } from "../docx-text";
import { DATE_RANGE, PHONE } from "./parse";
import { ATS_SIZE_LIMIT_BYTES, NO_SIGNALS, type AtsRead } from "./types";

const EMAIL = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i;
/** "01.11.2026", "11/2026", "2026-11-01": dates, which the phone pattern matches too */
const DATE_ONLY = /^(?:\d{1,2}[./-]){0,2}(?:19|20)\d{2}(?:[./-]\d{1,2}){0,2}$/;

/** The phone numbers in a text, as the parser finds them (lib/ats-read/parse.ts), without dates. */
const phonesIn = (text: string) =>
  [...text.matchAll(PHONE)].map((m) => m[0]).filter((p) => !DATE_RANGE.test(p) && !DATE_ONLY.test(p.replace(/\s+/g, "")));

/** A text box's content, without the copy Word keeps for old readers (<mc:Fallback>). */
const TEXT_BOX = /<w:txbxContent\b[\s\S]*?<\/w:txbxContent>/g;
const FALLBACK = /<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g;

const TABLE = /<w:tbl>[\s\S]*?<\/w:tbl>/g;

/**
 * The body as a plain reader such as python-docx gives it (the lab's DOCX reader): the paragraphs
 * outside tables first, then each table row by row, its cells joined by a tab. A whole-page table
 * (a sidebar layout) comes out as "Excel⇥EXPERIENCE": the heading glued to the sidebar.
 */
export function strictText(bodyXml: string): string {
  const tables = bodyXml.match(TABLE) ?? [];
  const rows = tables.flatMap((t) =>
    (t.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []).map((tr) =>
      (tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) ?? []).map((tc) => wordXmlText(tc)).join("\t"),
    ),
  );
  return [wordXmlText(bodyXml.replace(TABLE, "")), ...rows].filter((x) => x.trim()).join("\n");
}

/**
 * Reads a .docx the two ways ATS readers do: strictly (the body only, without page headers, footers
 * and text boxes; tables after the paragraphs, as python-docx gives them) and fully (what Word
 * shows, as `extractDocxText`). Returns null when the zip is not a Word document.
 */
export async function readDocx(data: ArrayBuffer): Promise<AtsRead | null> {
  const zip = await JSZip.loadAsync(data);
  const body = zip.file("word/document.xml");
  if (!body) return null;
  const xml = (await body.async("string")).replace(FALLBACK, "");

  const all = (await extractDocxText(data)) ?? "";
  const strict = strictText(xml.replace(TEXT_BOX, ""));

  const boxes = xml.match(TEXT_BOX) ?? [];
  const boxText = boxes.map((b) => wordXmlText(b)).join("\n");
  const sides: string[] = [];
  for (const f of zip.file(/^word\/(header|footer)\d*\.xml$/)) sides.push(wordXmlText(await f.async("string")));
  const outside = [...sides, boxText].join("\n");

  // a contact that a strict reader loses: in a header, footer or text box, and not in the body.
  // A date in a footer ("CV updated 01.11.2026") is not a phone number.
  const compact = strict.replace(/\s+/g, "");
  const inBody = (s: string) => compact.includes(s.replace(/\s+/g, ""));
  const email = outside.match(EMAIL);
  const lostEmail = email !== null && !inBody(email[0]);
  const lostPhone = phonesIn(outside).some((p) => !inBody(p));

  return {
    kind: "docx",
    bytes: data.byteLength,
    pages: null,
    producer: null,
    readings: [
      { reader: "docx-strict", text: strict },
      { reader: "docx-all", text: all },
    ],
    signals: {
      ...NO_SIGNALS,
      overSizeLimit: data.byteLength > ATS_SIZE_LIMIT_BYTES,
      contactsOutsideBody: lostEmail || lostPhone,
      tables: (xml.match(/<w:tbl>/g) ?? []).length,
      textBoxes: boxes.length,
      images: (xml.match(/<pic:pic\b/g) ?? []).length,
    },
  };
}
