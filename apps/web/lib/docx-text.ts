import JSZip from "jszip";

/**
 * The text of a Word .docx, read in the browser: the page headers first (Word CV templates often
 * keep the name and contacts there), then the body, then the footers. One line per paragraph;
 * tabs and line breaks inside a paragraph are kept as a space and a new line.
 *
 * Only displayed text is read: <w:t>. Field codes (<w:instrText>), deleted text (<w:delText>) and
 * the fallback copy Word keeps of every text box (<mc:Fallback>) are left out, so nothing appears
 * twice. List items start with "• ". Returns null when the file is a zip but not a Word document
 * (.xlsx, .pptx, .odt, .zip).
 */
export async function extractDocxText(data: ArrayBuffer): Promise<string | null> {
  const zip = await JSZip.loadAsync(data);
  const body = zip.file("word/document.xml");
  if (!body) return null;
  const parts = (prefix: string) =>
    zip
      .file(new RegExp(`^word/${prefix}\\d*\\.xml$`))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

  const seen = new Set<string>();
  const blocks: string[] = [];
  const add = (text: string) => {
    const t = text.trim();
    if (t && !seen.has(t)) {
      seen.add(t); // the first-page and the default header are often the same
      blocks.push(t);
    }
  };
  for (const f of parts("header")) add(wordXmlText(await f.async("string")));
  add(wordXmlText(await body.async("string")));
  for (const f of parts("footer")) add(wordXmlText(await f.async("string")));
  return blocks.join("\n");
}

const TOKEN =
  /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*)?\/>|<w:tab\/>|<w:(?:br|cr)\b[^>]*\/>|<\/w:p>|<w:p\b[^>]*\/>/g;

/** A paragraph that is a list item (Word numbering or a List style): it gets a "• " in front. */
const LIST_ITEM = /<w:numPr>|w:val="List(?:Bullet|Number|Paragraph)/;

/** Text of one WordprocessingML part (document, header or footer), one line per paragraph. */
export function wordXmlText(xml: string): string {
  const visible = xml
    .replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "")
    // Word draws a list's bullet itself, so the text has none: put one back, as a PDF shows it
    .replace(/(<w:p(?:\s[^>]*)?>)(\s*<w:pPr>[\s\S]*?<\/w:pPr>)/g, (m, open: string, ppr: string) =>
      LIST_ITEM.test(ppr) ? `${open}${ppr}<w:r><w:t>• </w:t></w:r>` : m,
    );
  let out = "";
  for (const m of visible.matchAll(TOKEN)) {
    const tag = m[0];
    if (m[1] !== undefined) out += decodeXml(m[1]);
    else if (tag.startsWith("<w:tab")) out += "\t";
    else if (tag.startsWith("<w:br") || tag.startsWith("<w:cr")) out += "\n";
    else if (tag === "</w:p>" || tag.startsWith("<w:p")) out += "\n";
  }
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function decodeXml(s: string): string {
  return s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (_, hex, dec, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[name.toLowerCase() as "amp"];
  });
}
