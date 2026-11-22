// A post's body: Markdown turned into React elements by react-markdown (no raw HTML is rendered,
// so no HTML-string prop is ever needed: AGENTS.md rule 3). Three things are ours:
// - every ## heading gets the id the table of contents links to (lib/blog/posts.ts makes the same ids);
// - a fenced block named blog-<name> is replaced by that figure (components/blog/blocks.tsx);
// - a quote whose last paragraph starts with a dash shows that paragraph as who said it.
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Element, ElementContent } from "hast";
import { slugify } from "@/lib/blog/text";
import type { Post } from "@/lib/blog/schema";
import { BLOCKS } from "./blocks";

const MARKER = /^language-blog-([a-z-]+)$/;

function textOf(node: Element | ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/** The figure a <pre> stands for, if its code block is a blog-<name> marker. */
export function markerOf(pre: Element | undefined): string | null {
  const code = pre?.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
  const classes = code?.properties?.className;
  for (const c of Array.isArray(classes) ? classes : []) {
    const m = MARKER.exec(String(c));
    if (m) return m[1];
  }
  return null;
}

function reactText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactText).join("");
  if (isValidElement(node)) return reactText((node as ReactElement<{ children?: ReactNode }>).props.children);
  return "";
}

const BY = /^[—–-]\s*/;

function Quote({ children }: { children: ReactNode }) {
  const parts = Children.toArray(children).filter((c) => !(typeof c === "string" && !c.trim()));
  const by = parts.length > 1 ? reactText(parts[parts.length - 1]) : "";
  const hasBy = BY.test(by);
  return (
    <figure className="blog-quote">
      <span className="blog-quote__mark" aria-hidden="true">
        “
      </span>
      <blockquote className="blog-quote__text">{hasBy ? parts.slice(0, -1) : parts}</blockquote>
      {hasBy && <figcaption className="blog-quote__by">{by.replace(BY, "")}</figcaption>}
    </figure>
  );
}

export default function ArticleBody({ post }: { post: Post }) {
  const components: Components = {
    h2: ({ node, children }) => <h2 id={node ? slugify(textOf(node)) : undefined}>{children}</h2>,
    a: ({ href = "", children }) =>
      /^https?:\/\//.test(href) ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ) : (
        <a href={href}>{children}</a>
      ),
    pre: ({ node, children }) => {
      const name = markerOf(node);
      if (!name) return <pre>{children}</pre>;
      const Figure = BLOCKS[name];
      if (!Figure) throw new Error(`content/blog/${post.slug}.md: there is no figure called "blog-${name}"`);
      return <Figure post={post} />;
    },
    blockquote: ({ children }) => <Quote>{children}</Quote>,
  };

  return (
    <div className="blog-prose">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {post.body}
      </Markdown>
    </div>
  );
}
