/**
 * The job text out of a job post's HTML, without running anything from the page:
 * 1. the page's structured data (JSON-LD `JobPosting`, the format Google for Jobs reads, which most
 *    job boards and ATSs publish): title, employer and the description;
 * 2. otherwise the visible text of the page's main block (`<main>`, `<article>`, or the body), with
 *    scripts, styles, navigation, header and footer left out.
 * The result is plain text: it goes into the job field as text and is never shown as HTML.
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
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML as plain text: one line per block, "• " for list items, no tags, no scripts. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|section|article|main|header|footer|ul|ol|li|h[1-6]|tr|table|dl|dt|dd|blockquote|pre)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
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

const str = (v: unknown) => (typeof v === "string" && v.trim() ? decodeEntities(v.trim()) : null);

function fromStructuredData(html: string): JobPost | null {
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
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

function fromPageText(html: string): JobPost {
  const without = html.replace(/<(script|style|noscript|template|svg|iframe|head)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const block =
    without.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i)?.[1] ??
    without.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i)?.[1] ??
    without.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ??
    without;
  const cleaned = block.replace(/<(nav|header|footer|form|aside)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const title = str(html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]?.replace(/\s+/g, " "));
  return { title, company: null, text: htmlToText(cleaned).slice(0, MAX_JOB_TEXT), from: "page_text" };
}

/** The job post in a page, or null when the page holds no usable job text. */
export function extractJobPost(html: string): JobPost | null {
  const post = fromStructuredData(html) ?? fromPageText(html);
  return post.text.length >= MIN_JOB_TEXT ? post : null;
}
