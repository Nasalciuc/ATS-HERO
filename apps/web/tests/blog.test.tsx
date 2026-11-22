// The blog's posts are Markdown files checked at build time (lib/blog/schema.ts). These checks keep
// what the schema can't see honest:
// - every figure a body places (```blog-<name>```) exists and has its data in the frontmatter;
// - the table of contents links to ids the rendered body really has;
// - every post sends the reader to the check, and "Keep reading" names real posts;
// - links that leave the site open in a new tab without handing it our page (noopener).
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The post page imports these client components (Clerk, router hooks); the other page tests mock them the same way.
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

import { allPosts, parsePost } from "@/lib/blog/posts";
import { slugify } from "@/lib/blog/text";
import { BLOCK_DATA } from "@/components/blog/blocks";
import ArticleBody from "@/components/blog/ArticleBody";
import BlogPostPage, { tocOf } from "@/views/BlogPostPage";
import BlogListPage from "@/views/BlogListPage";
import { blogJsonLd, blogPostJsonLd } from "@/lib/structured-data";
import { AUTHORS } from "@/lib/blog/authors";
import { SITE_URL } from "@/lib/site";

const posts = allPosts();
const MARKERS = /^```blog-([a-z-]+)[ \t]*$/gm;

const sample = (frontmatter: string, body = "Text.") => `---\n${frontmatter}\n---\n\n${body}\n`;
const VALID = [
  "title: A post about how an ATS reads",
  `description: "${"A description long enough to be used by search engines and short enough not to be cut. ".repeat(2).slice(0, 140)}"`,
  "dek: The line under the title.",
  "topic: how-ats-works",
  "cover: score",
  "author: vladimir-nasalciuc",
  "publishedAt: 2026-11-13",
  "updatedAt: 2026-11-13",
  "sources:",
  "  - title: A source",
  "    url: https://example.com/a",
].join("\n");

describe("blog posts", () => {
  it("has at least one post, and every post's frontmatter matches the schema", () => {
    expect(posts.length).toBeGreaterThan(0);
  });

  it("stops a post that misses a field, and names the file and the field", () => {
    expect(() => parsePost("broken-post", sample(VALID.replace(/sources:[\s\S]*$/, "")))).toThrow(
      /content\/blog\/broken-post\.md: sources/,
    );
    expect(() => parsePost("long-title", sample(VALID.replace("title: A post about how an ATS reads", `title: ${"x".repeat(61)}`)))).toThrow(
      /title/,
    );
    expect(() => parsePost("Bad_Name", sample(VALID))).toThrow(/file name/);
    expect(parsePost("good-post", sample(VALID)).slug).toBe("good-post");
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: every figure it places exists and has its data", (_slug, post) => {
    const used = [...post.body.matchAll(MARKERS)].map((m) => m[1]);
    for (const name of used) {
      expect(Object.keys(BLOCK_DATA), `unknown figure blog-${name}`).toContain(name);
      const field = BLOCK_DATA[name];
      if (field) expect(post[field], `blog-${name} needs "${field}" in the frontmatter`).toBeDefined();
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: sends the reader to the check", (_slug, post) => {
    expect(/^```blog-cta[ \t]*$/m.test(post.body) || post.body.includes("](/app/improve)")).toBe(true);
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: names only real posts under Keep reading", (slug, post) => {
    for (const other of post.related) {
      expect(other).not.toBe(slug);
      expect(posts.map((p) => p.slug)).toContain(other);
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: the contents link to ids the page has, each once", (_slug, post) => {
    const toc = tocOf(post);
    expect(new Set(toc.map((h) => h.id)).size).toBe(toc.length);
    const html = renderToStaticMarkup(<BlogPostPage post={post} related={[]} />);
    for (const heading of toc) {
      expect(html.match(new RegExp(`id="${heading.id}"`, "g")) ?? [], `#${heading.id}`).toHaveLength(1);
      expect(heading.id).toBe(heading.id === "short-answer" || heading.id === "faq" || heading.id === "sources" ? heading.id : slugify(heading.text));
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: the body renders its figures, not code blocks", (_slug, post) => {
    const html = renderToStaticMarkup(<ArticleBody post={post} />);
    expect(html).not.toContain("language-blog-");
    expect(html).not.toContain("<pre");
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: links that leave the site open apart, with noopener", (_slug, post) => {
    const html = renderToStaticMarkup(<BlogPostPage post={post} related={[]} />);
    const external = [...html.matchAll(/<a [^>]*href="https?:\/\/[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(external.length).toBeGreaterThan(0);
    for (const tag of external) {
      expect(tag).toContain('target="_blank"');
      expect(tag).toContain('rel="noopener noreferrer"');
    }
  });

  it.each(posts.map((p) => [p.slug, p] as const))("%s: its JSON-LD says what the page shows", (_slug, post) => {
    const graph = blogPostJsonLd(post)["@graph"] as Record<string, any>[];
    const article = graph.find((n) => n["@type"] === "BlogPosting")!;
    expect(article.headline).toBe(post.title);
    expect(article.description).toBe(post.description);
    expect(article.datePublished).toBe(post.publishedAt);
    expect(article.dateModified).toBe(post.updatedAt);
    expect(article.author).toEqual({ "@type": "Person", name: AUTHORS[post.author].name, jobTitle: AUTHORS[post.author].role });
    expect(article.citation).toEqual(post.sources.map((s) => s.url));
    const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList")!.itemListElement as { item: string }[];
    expect(crumbs.map((c) => c.item)).toEqual([`${SITE_URL}/`, `${SITE_URL}/blog`, `${SITE_URL}/blog/${post.slug}`]);
  });

  it("the /blog JSON-LD lists every post, newest first", () => {
    const blog = (blogJsonLd(posts)["@graph"] as Record<string, any>[]).find((n) => n["@type"] === "Blog")!;
    expect(blog.blogPost.map((p: { url: string }) => p.url)).toEqual(posts.map((p) => `${SITE_URL}/blog/${p.slug}`));
  });

  it("lists every post on /blog, newest first", () => {
    const html = renderToStaticMarkup(<BlogListPage posts={posts} />);
    for (const post of posts) expect(html).toContain(`href="/blog/${post.slug}"`);
    const dates = posts.map((p) => p.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
