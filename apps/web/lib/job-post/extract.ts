/**
 * The job text out of a job post's HTML, without running anything from the page:
 * 1. the page's structured data (JSON-LD `JobPosting`, the format Google for Jobs reads, which most
 *    job boards and ATSs publish): title, employer and the description;
 * 2. otherwise (or when that text is too short) the visible text of the page's main block (`<main>`,
 *    `<article>`, or the body), with scripts, styles, comments, navigation and the page's own
 *    header and footer left out.
 * The result is plain text: it goes into the job field as text and is never shown as HTML.
 *
 * Every step takes time in proportion to the page's length, whatever the page holds: a closer is
 * searched for from where its opener ends (and once, if it isn't there), no pattern can scan past
 * the next "<" or ">", and nothing is lowercased (a copy of 3 MB of "İ" took half a second). A pattern like
 * `<script[\s\S]*?</script>` would scan to the end of the page once per opener, and a page of
 * openers with no closer (a few KB gzipped) would hold the server for hours.
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
const MAX_NAME = 200;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", bull: "•", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** A tag name ends at a space, "/" or ">": "<main" is not "<main-nav", "</svg" is not "</svg-icon". */
const END = "(?=[\\s/>])";

const CLOSERS = new Map<string, RegExp>();
/** Where `</name` (any case, followed by a space, "/", ">" or the end) is, at or after `from`; -1 if nowhere. */
function closerAt(html: string, name: string, from: number): number {
  let re = CLOSERS.get(name);
  if (!re) CLOSERS.set(name, (re = new RegExp(`</${name}(?=[\\s/>]|$)`, "gi")));
  re.lastIndex = from;
  return re.exec(html)?.index ?? -1;
}

/** What isn't shown: their content never reaches the text. */
const HIDDEN = ["script", "style", "noscript", "template", "svg", "iframe"];
/** Never closed, these take the rest of the page, as in a browser. An unclosed <svg> doesn't: it is text. */
const DROP_REST: ReadonlySet<string> = new Set(["script", "style", "noscript", "template", "iframe"]);
/** Around the job, not the job: the page's own navigation, header and footer, forms, side bars. */
const AROUND = ["nav", "header", "footer", "form", "aside"];
/** Inside the job's <main> or <article>, a <header> holds the job's title: it stays. */
const AROUND_IN_JOB = ["nav", "footer", "form", "aside"];
/** When dropping the blocks around the job leaves no job (an ASP.NET <form> wraps whole pages). */
const AROUND_LAST_TRY = ["nav", "footer"];
const NONE: ReadonlySet<string> = new Set();

/**
 * The HTML without its `<name …>…</name>` blocks (and comments, if asked), in one pass. A comment
 * or a block named in `dropRest` that is never closed takes the rest of the page with it; any other
 * unclosed block keeps what follows it. `<svg … />` closes itself.
 */
function dropBlocks(html: string, names: string[], dropRest: ReadonlySet<string>, comments: boolean): string {
  const opener = new RegExp(`<(?:(${names.join("|")})${END}([^<>]*)>${comments ? "|(!--)" : ""})`, "gi");
  // a closer not found from one place is not found from any later place: search for it once
  const neverClosed = new Set<string>();
  let out = "";
  let from = 0;
  for (let m = opener.exec(html); m; m = opener.exec(html)) {
    if (m[3]) {
      const end = html.indexOf("-->", m.index + 2); // "<!-->" is a whole (empty) comment
      if (end < 0) return out + html.slice(from, m.index);
      out += html.slice(from, m.index) + " ";
      from = opener.lastIndex = end + 3;
      continue;
    }
    const name = m[1].toLowerCase();
    if (name === "svg" && m[2].endsWith("/")) {
      out += html.slice(from, m.index) + " ";
      from = opener.lastIndex;
      continue;
    }
    const at = neverClosed.has(name) ? -1 : closerAt(html, name, opener.lastIndex);
    if (at < 0) {
      if (dropRest.has(name)) return out + html.slice(from, m.index);
      neverClosed.add(name);
      continue; // keep the opener and what follows it; the tag pass drops the opener itself
    }
    out += html.slice(from, m.index) + " ";
    const gt = html.indexOf(">", at);
    from = opener.lastIndex = gt < 0 ? html.length : gt + 1;
  }
  return out + html.slice(from);
}

/** Scripts, styles, comments and the like gone, before anything else looks at the page. */
const withoutHidden = (html: string) => dropBlocks(html, HIDDEN, DROP_REST, true);

/**
 * The HTML without its `<head>`: up to `</head>`, or up to `<body>` when the page leaves `</head>`
 * out (HTML allows that). With neither, only the `<head>` tag goes. Run it on HTML without
 * scripts and comments, so a "<body" inside one doesn't end the head early.
 */
function dropHead(html: string): string {
  const open = new RegExp(`<head${END}[^<>]*>`, "i").exec(html);
  if (!open) return html;
  const start = open.index + open[0].length;
  const end = new RegExp(`</head${END}|<body${END}`, "gi");
  end.lastIndex = start;
  const at = end.exec(html)?.index ?? start;
  return html.slice(0, open.index) + " " + html.slice(at);
}

/** HTML as plain text: one line per block, "• " for list items, no tags, no scripts. */
export function htmlToText(html: string): string {
  const text = dropHead(withoutHidden(html))
    .replace(/<li\b[^<>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|div|section|article|main|header|footer|ul|ol|li|h[1-6]|tr|table|dl|dt|dd|blockquote|pre)\b[^<>]*>/gi, "\n")
    .replace(/<[^<>]*>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t ​]+/g, " ")
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

/** A short name (title, employer): text, entities decoded, spaces collapsed, at most 200 characters. */
const shortText = (v: unknown) =>
  typeof v === "string" && v.trim() ? decodeEntities(v).replace(/\s+/g, " ").trim().slice(0, MAX_NAME) || null : null;

/** The contents of each `<script type="application/ld+json">` block; commented-out scripts are skipped. */
function* jsonLdBlocks(html: string): Generator<string> {
  const opener = new RegExp(`<script${END}[^<>]*>|<!--`, "gi");
  for (let m = opener.exec(html); m; m = opener.exec(html)) {
    if (m[0] === "<!--") {
      const end = html.indexOf("-->", m.index + 2);
      if (end < 0) return;
      opener.lastIndex = end + 3;
      continue;
    }
    const start = m.index + m[0].length;
    const end = closerAt(html, "script", start);
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
      const raw = typeof node.description === "string" ? node.description.trim() : "";
      if (!raw) continue;
      // A description written as HTML keeps its entities until htmlToText decodes them last:
      // decoded first, a job that mentions "&lt;template&gt;" would get a real, unclosed <template>.
      // One written as escaped HTML ("&lt;p&gt;…") is decoded once to become HTML.
      const body = htmlToText(/<[a-z!/]/i.test(raw) ? raw : decodeEntities(raw));
      const org = node.hiringOrganization as Record<string, unknown> | string | undefined;
      const company = typeof org === "string" ? shortText(org) : shortText(org?.name);
      const title = shortText(node.title);
      const text = [title, company, body].filter(Boolean).join("\n\n");
      return { title, company, text: text.slice(0, MAX_JOB_TEXT), from: "structured_data" };
    }
  }
  return null;
}

/** What is inside the first `<name …>` block, up to its first closer; null without both. */
function inside(html: string, tag: string): string | null {
  const open = new RegExp(`<${tag}${END}[^<>]*>`, "i").exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const end = closerAt(html, tag, start);
  return end < 0 ? null : html.slice(start, end);
}

function fromPageText(html: string): JobPost {
  const shown = withoutHidden(html); // the head is still there, for the title
  const title = shortText(inside(shown, "title"));
  const visible = dropHead(shown);
  const job = inside(visible, "main") ?? inside(visible, "article");
  const block = job ?? inside(visible, "body") ?? visible;
  let text = htmlToText(dropBlocks(block, job !== null ? AROUND_IN_JOB : AROUND, NONE, false));
  if (text.length < MIN_JOB_TEXT) text = htmlToText(dropBlocks(block, AROUND_LAST_TRY, NONE, false));
  return { title, company: null, text: text.slice(0, MAX_JOB_TEXT), from: "page_text" };
}

/** The job post in a page, or null when the page holds no usable job text. */
export function extractJobPost(html: string): JobPost | null {
  const structured = fromStructuredData(html);
  if (structured && structured.text.length >= MIN_JOB_TEXT) return structured;
  const page = fromPageText(html);
  return page.text.length >= MIN_JOB_TEXT ? page : null;
}
