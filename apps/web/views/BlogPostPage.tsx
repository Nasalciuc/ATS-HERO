// /blog/[slug]: one post. The header has the title, the author and the post's cover; then the
// table of contents beside the text (sticky on wide screens; a row that opens, above the text, on
// narrower ones), the questions, the share row, the author box and the sources; then the related
// posts and the check on a mint band. A thin bar at the top of the window fills as the page is read
// (CSS only, where the browser can tie it to the scroll). Designed in Claude (canvas "ATS Hero
// Blog", 13 Nov 2026).
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ArticleBody from "@/components/blog/ArticleBody";
import BlogFaq from "@/components/blog/BlogFaq";
import BlogToc from "@/components/blog/BlogToc";
import PostCover from "@/components/blog/PostCover";
import ShareRow from "@/components/blog/ShareRow";
import {
  AuthorBox,
  AuthorLine,
  CheckBand,
  CheckTip,
  ContentsFold,
  PostCard,
  PostMeta,
  Sources,
  postHref,
} from "@/components/blog/parts";
import type { Heading, Post } from "@/lib/blog/schema";
import { formatDate } from "@/lib/blog/text";
import { TOPICS } from "@/lib/blog/topics";
import { SITE_URL } from "@/lib/site";

export const FAQ_HEADING: Heading = { id: "faq", text: "Questions people ask" };
export const SOURCES_HEADING: Heading = { id: "sources", text: "Sources" };
export const SHORT_ANSWER_HEADING: Heading = { id: "short-answer", text: "The short answer" };

/** What "In this guide" lists: the short answer if the post has one, its ## headings, the FAQ, the sources. */
export function tocOf(post: Post): Heading[] {
  return [
    ...(/^```blog-short-answer\s*$/m.test(post.body) ? [SHORT_ANSWER_HEADING] : []),
    ...post.headings,
    ...(post.faq.length > 0 ? [FAQ_HEADING] : []),
    SOURCES_HEADING,
  ];
}

export default function BlogPostPage({ post, related }: { post: Post; related: Post[] }) {
  const toc = tocOf(post);
  return (
    <>
      <Navbar />
      <main className="blog blog-post">
        <div className="blog-progress" aria-hidden="true" />
        <header className="blog-post__hero">
          <div className="container">
            <nav className="blog-crumbs" aria-label="Breadcrumb">
              <ol>
                <li>
                  <a href="/blog">Blog</a>
                </li>
                <li>{TOPICS[post.topic].label}</li>
              </ol>
            </nav>
            <div className="blog-post__head">
              <div className="blog-post__intro">
                <PostMeta post={post} />
                <h1 className="blog-post__title">{post.title}</h1>
                <p className="blog-post__dek">{post.dek}</p>
                <AuthorLine author={post.author} date={`Updated ${formatDate(post.updatedAt)}`} />
              </div>
              <div className="blog-post__cover">
                <PostCover cover={post.cover} size="hero" />
              </div>
            </div>
          </div>
        </header>

        <div className="container blog-post__layout">
          <aside className="blog-post__side">
            <BlogToc items={toc} />
            <CheckTip className="blog-post__tip" />
          </aside>

          <article className="blog-post__main">
            <ContentsFold items={toc} />
            <ArticleBody post={post} />

            {post.faq.length > 0 && (
              <section className="blog-post__faq" aria-labelledby={FAQ_HEADING.id}>
                <h2 className="blog-post__h2" id={FAQ_HEADING.id}>
                  {FAQ_HEADING.text}
                </h2>
                <BlogFaq items={post.faq} />
              </section>
            )}

            <ShareRow url={`${SITE_URL}${postHref(post.slug)}`} />
            <AuthorBox post={post} />
            <Sources post={post} />
          </article>
        </div>

        {related.length > 0 && (
          <section className="blog-more" aria-labelledby="blog-more-title">
            <div className="container">
              <div className="blog-more__head">
                <h2 className="blog-more__title" id="blog-more-title">
                  Keep reading
                </h2>
                <a className="blog-more__all" href="/blog">
                  All guides
                </a>
              </div>
              <div className="blog-cards">
                {related.map((p) => (
                  <PostCard post={p} key={p.slug} />
                ))}
              </div>
            </div>
          </section>
        )}

        <CheckBand />
      </main>
      <Footer />
    </>
  );
}
