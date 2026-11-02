/**
 * The job text out of a job post's HTML, without running anything from the page:
 * 1. the page's structured data (JSON-LD `JobPosting`, the format Google for Jobs reads, which most
 *    job boards and ATSs publish): title, employer and the description;
 * 2. otherwise the visible text of the page's main block (`<main>`, `<article>`, or the body), with
 *    scripts, styles, navigation, header and footer left out.
 * The result is plain text: it goes into the job field as text and is never shown as HTML.
 *
 * Every step takes time in proportion to the page's length, whatever the page holds: blocks are
 * found with indexOf on a lowercased copy, and no pattern can scan past the next "<" or ">". A
 * pattern like `<script[\s\S]*?</script>` would scan to the end of the page once per opener, and a
 * page of openers with no closer (a few KB gzipped) would hold the server for hours.
 */

export interface JobPost {
  title: string | null;
  company: string | null;
  text: string;
  /** where the text came from */
  from: "structured_data" | "page_text";
}

/** Below this, the page has no job text we can use (a page that loads it with JavaScript). */
export const MIN_JOB_TEXT = 200;
const MAX_JOB_TEXT = 30_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", bull: "•", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** What isn't shown: their content never reaches the text. */
const HIDDEN = ["script", "style", "noscript", "template", "svg", "iframe"];
/** Around the job, not the job. */
const AROUND = ["nav", "header", "footer", "form", "aside"];

/** Lowercase that keeps every index: only A–Z change ("İ".toLowerCase() is two characters). */
const asciiLower = (s: string) => s.replace(/[A-Z]+/g, (c) => c.toLowerCase());

/**
 * The HTML without its `<name …>…</name>` blocks (and comments, if asked), in one pass. A comment
 * or a hidden block that is never closed takes the rest of the page with it, as in a browser; an
 * unclosed block around the job keeps what follows it.
 */
function dropBlocks(html: string, names: string[], unclosed: "drop_rest" | "keep", comments = false): string {
  const lower = asciiLower(html);
  const opener = new RegExp(`<(?:(${names.join("|")})\\b${comments ? "|(!--)" : ""})`, "gi");
  // a closer not found from one place is not found from any later place: search for it once
  const neverClosed = new Set<string>();
  let out = "";
  let from = 0;
  for (let m = opener.exec(html); m; m = opener.exec(html)) {
    const comment = Boolean(m[2]);
    const closer = comment ? "-->" : `</${asciiLower(m[1])}`;
    const at = neverClosed.has(closer) ? -1 : lower.indexOf(closer, m.index + m[0].length);
    if (at < 0) {
      if (comment || unclosed === "drop_rest") return out + html.slice(from, m.index);
      neverClosed.add(closer);
      continue; // keep the opener and what follows it; the tag pass drops the opener itself
    }
    out += html.slice(from, m.index) + " ";
    const gt = lower.indexOf(">", at);
    from = comment ? at + 3 : gt < 0 ? html.length : gt + 1;
    opener.lastIndex = from;
  }
  return out + html.slice(from);
}

/**
 * The HTML without its `<head>`: up to `</head>`, or up to `<body>` when the page leaves `</head>`
 * out (HTML allows that). With neither, only the `<head>` tag goes.
 */
function dropHead(html: string): string {
  const open = /<head\b[^<>]*>/i.exec(html);
  if (!open) return html;
  const start = open.index + open[0].length;
  const end = /<\/head\b|<body\b/gi; // the first of the two, never "</header"
  end.lastIndex = start;
  const at = end.exec(html)?.index ?? start;
  return html.slice(0, open.index) + " " + html.slice(at);
}

/** HTML as plain text: one line per block, "• " for list items, no tags, no scripts. */
export function htmlToText(html: string): string {
  const text = dropBlocks(dropHead(html), HIDDEN, "drop_rest", true)
    .replace(/<li\b[^<>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|section|article|main|header|footer|ul|ol|li|h[1-6]|tr|table|dl|dt|dd|blockquote|pre)\b[^<>]*>/gi, "\n")
    .replace(/<[^<>]*>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\u00a0\u200b]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l, i, all) => l || (i > 0 && all[i - 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const typeIs = (node: Record<string, unknown>, t: string) =>
  [node["@type"]].flat().some((x) => typeof x === "string" && x.toLowerCase() === t.toLowerCase());

/** Every object in a JSON-LD value: arrays, `@graph`, nested objects. */
function* objectsIn(value: unknown, depth = 0): Generator<Record<string, unknown>> {
  if (depth > 6 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) yield* objectsIn(v, depth + 1);
    return;
  }
  const obj = value as Record<string, unknown>;
  yield obj;
  for (const v of Object.values(obj)) if (v && typeof v === "object") yield* objectsIn(v, depth + 1);
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? decodeEntities(v.trim()) : null);

/** The contents of each `<script type="application/ld+json">` block. */
function* jsonLdBlocks(html: string): Generator<string> {
  const lower = asciiLower(html);
  const opener = /<script\b[^<>]*>/gi;
  for (let m = opener.exec(html); m; m = opener.exec(html)) {
    const start = m.index + m[0].length;
    const end = lower.indexOf("</script", start);
    if (end < 0) return;
    if (/type\s*=\s*["']?application\/ld\+json/i.test(m[0])) yield html.slice(start, end);
    opener.lastIndex = end;
  }
}

function fromStructuredData(html: string): JobPost | null {
  for (const block of jsonLdBlocks(html)) {
    let data: unknown;
    try {
      data = JSON.parse(block.trim());
    } catch {
      continue; // a broken block: try the next one
    }
    for (const node of objectsIn(data)) {
      if (!typeIs(node, "JobPosting")) continue;
      const description = str(node.description);
      if (!description) continue;
      const org = node.hiringOrganization as Record<string, unknown> | string | undefined;
      const company = typeof org === "string" ? str(org) : str(org?.name);
      const title = str(node.title);
      const body = htmlToText(description);
      const text = [title, company, body].filter(Boolean).join("\n\n");
      return { title, company, text: text.slice(0, MAX_JOB_TEXT), from: "structured_data" };
    }
  }
  return null;
}

/** What is inside the first `<name …>` block, up to its first closer; null without both. */
function inside(html: string, lower: string, name: string): string | null {
  const open = new RegExp(`<${name}\\b[^<>]*>`, "i").exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const end = lower.indexOf(`</${name}`, start);
  return end < 0 ? null : html.slice(start, end);
}

function fromPageText(html: string): JobPost {
  const titleBlock = inside(html, asciiLower(html), "title");
  const visible = dropBlocks(dropHead(html), HIDDEN, "drop_rest", true);
  const lower = asciiLower(visible);
  const block = inside(visible, lower, "main") ?? inside(visible, lower, "article") ?? inside(visible, lower, "body") ?? visible;
  const cleaned = dropBlocks(block, AROUND, "keep");
  const title = str(titleBlock?.replace(/\s+/g, " "));
  return { title, company: null, text: htmlToText(cleaned).slice(0, MAX_JOB_TEXT), from: "page_text" };
}

/** The job post in a page, or null when the page holds no usable job text. */
export function extractJobPost(html: string): JobPost | null {
  const post = fromStructuredData(html) ?? fromPageText(html);
  return post.text.length >= MIN_JOB_TEXT ? post : null;
}
