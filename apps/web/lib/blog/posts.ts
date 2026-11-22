// The blog's posts: one Markdown file per post in content/blog/, read at build time (the blog's
// pages are static). A post whose frontmatter doesn't match lib/blog/schema.ts stops the build with
// the file and the field named, so a post can't go out without its date, sources or description.
import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { postSchema, type Heading, type Post } from "./schema";
import { plainText, slugify } from "./text";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
/** Fenced blocks: the figures' markers (```blog-steps```) and any code. Not prose, not headings. */
const FENCES = /^```[\s\S]*?^```\s*$/gm;
const WORDS_PER_MINUTE = 230;

export function headingsOf(body: string): Heading[] {
  return [...body.replace(FENCES, "").matchAll(/^##[ \t]+(.+?)[ \t]*#*$/gm)].map((m) => {
    const text = plainText(m[1]);
    return { id: slugify(text), text };
  });
}

function countWords(value: unknown): number {
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean).length;
  if (Array.isArray(value)) return value.reduce((n: number, v) => n + countWords(v), 0);
  if (value && typeof value === "object") return countWords(Object.values(value));
  return 0;
}

export function parsePost(slug: string, raw: string): Post {
  if (!SLUG.test(slug)) throw new Error(`content/blog/${slug}.md: the file name must be lower case words joined by dashes`);
  const match = FRONTMATTER.exec(raw);
  if (!match) throw new Error(`content/blog/${slug}.md: the file must start with a --- frontmatter block`);
  const parsed = postSchema.safeParse(parseYaml(match[1]));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".") || "frontmatter"}: ${i.message}`).join("; ");
    throw new Error(`content/blog/${slug}.md: ${fields}`);
  }
  const meta = parsed.data;
  const body = match[2].trim();
  // What a reader reads: the prose plus the figures' words (the short answer, the cards, the FAQ…).
  const figures = [meta.shortAnswer, meta.levels, meta.atsScores, meta.titleFilter, meta.lab, meta.faq];
  const words = countWords(body.replace(FENCES, "")) + countWords(figures);
  return {
    ...meta,
    slug,
    body,
    headings: headingsOf(body),
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  };
}

/**
 * Every post, newest first (by publishedAt, then by title so the order never wobbles).
 * The folder is a fixed path on purpose: the build's file tracing can then see which files are read
 * (a folder passed in as a parameter makes it pack the whole project into the server code).
 */
export function allPosts(): Post[] {
  return fs
    .readdirSync(path.join(process.cwd(), "content", "blog"))
    .filter((file) => file.endsWith(".md"))
    .map((file) =>
      parsePost(file.slice(0, -3), fs.readFileSync(path.join(process.cwd(), "content", "blog", file), "utf8")),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
}

export function postBySlug(slug: string): Post | undefined {
  return allPosts().find((post) => post.slug === slug);
}

/** The posts a post links to under "Keep reading", in the order its frontmatter lists them. */
export function relatedPosts(post: Post, posts: Post[] = allPosts()): Post[] {
  return post.related.map((slug) => posts.find((p) => p.slug === slug)).filter((p): p is Post => Boolean(p));
}
