// /blog: the newest post in front, then the rest, then the check on a mint band.
// - From four posts on: the newest beside "Latest" (the next three) and the Pro Tips card, the rest
//   in a grid. That is the canvas layout; it needs a full "Latest" to sit beside a tall post.
// - With fewer: the newest as one wide card, the cover beside the text, and the others in the grid.
//   A short side column next to the tall post left a hole under it.
// Sections with nothing to show are left out. Designed in Claude (canvas "ATS Hero Blog", 13 Nov
// 2026); Liubovi brings it to Figma, then it gets its data-figma keys and a spec (AGENTS.md rule 6,
// the blog's exception).
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckBand, CheckTip, Feature, LatestList, PostCard, Spotlight } from "@/components/blog/parts";
import type { Post } from "@/lib/blog/schema";

/** From this many posts on, the newest gets the "Latest" column beside it instead of the wide card. */
export const SIDE_LAYOUT_FROM = 4;

export default function BlogListPage({ posts }: { posts: Post[] }) {
  const [newest, ...rest] = posts;
  const withSide = posts.length >= SIDE_LAYOUT_FROM;
  const latest = withSide ? rest.slice(0, 3) : [];
  const more = withSide ? rest.slice(3) : rest;

  return (
    <>
      <Navbar />
      <main className="blog">
        <section className="blog-head">
          <div className="container">
            <p className="blog-head__eyebrow">The ATS Hero blog</p>
            <h1 className="blog-head__title">How an ATS really reads your CV</h1>
            <p className="blog-head__lead">
              Tested in our lab, checked against the vendors’ own documentation, with every source listed.
            </p>
          </div>
        </section>

        {newest &&
          (withSide ? (
            <section className="blog-top" aria-label="Newest guides">
              <div className="container blog-top__inner">
                <Spotlight post={newest} />
                <div className="blog-top__side">
                  <LatestList posts={latest} />
                  <CheckTip />
                </div>
              </div>
            </section>
          ) : (
            <section className="blog-top" aria-label="Newest guide">
              <div className="container">
                <Feature post={newest} />
              </div>
            </section>
          ))}

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
