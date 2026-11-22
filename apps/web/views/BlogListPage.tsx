// /blog: the newest post in front, the next three under "Latest", the rest in a grid, then the
// check on a mint band. Sections with nothing to show are left out, so the page reads well with one
// post as with twenty. Designed in Claude (canvas "ATS Hero Blog", 13 Nov 2026); Liubovi brings it
// to Figma, then it gets its data-figma keys and a spec (AGENTS.md rule 6, the blog's exception).
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckBand, CheckTip, LatestList, PostCard, Spotlight } from "@/components/blog/parts";
import type { Post } from "@/lib/blog/schema";

export default function BlogListPage({ posts }: { posts: Post[] }) {
  const [spotlight, ...rest] = posts;
  const latest = rest.slice(0, 3);
  const more = rest.slice(3);

  return (
    <>
      <Navbar />
      <main className="blog">
        <section className="blog-head">
          <div className="container">
            <h1 className="blog-head__title">The ATS Hero blog</h1>
            <p className="blog-head__lead">
              How an ATS really reads your CV: tested in our lab, checked against the vendors&apos; own documentation.
            </p>
          </div>
        </section>

        {spotlight && (
          <section className="blog-top" aria-label="Newest guides">
            <div className="container blog-top__inner">
              <Spotlight post={spotlight} />
              <div className="blog-top__side">
                {latest.length > 0 && <LatestList posts={latest} />}
                <CheckTip />
              </div>
            </div>
          </section>
        )}

        {more.length > 0 && (
          <section className="blog-all" aria-labelledby="blog-all-title">
            <div className="container">
              <h2 className="blog-all__title" id="blog-all-title">
                More guides
              </h2>
              <div className="blog-cards">
                {more.map((post) => (
                  <PostCard post={post} key={post.slug} />
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
