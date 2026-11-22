// The blog's small pieces, shared by the list (/blog) and the post (/blog/[slug]).
// Links into /app are plain <a>: a full page load, so nothing a public page loaded comes along
// into the app (the same reason the Navbar and the landing use <a>).
import { AUTHORS, type AuthorId } from "@/lib/blog/authors";
import { formatDate } from "@/lib/blog/text";
import type { Post } from "@/lib/blog/schema";
import { TOPICS, type Topic } from "@/lib/blog/topics";
import { TipsBulb } from "@/components/figma-icons";
import PostCover from "./PostCover";

export const postHref = (slug: string) => `/blog/${slug}`;

/** The check every call to action opens: Improve My Resume, read in the browser. */
export const CHECK_HREF = "/app/improve";

export function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function TopicChip({ topic }: { topic: Topic }) {
  const { label, tone } = TOPICS[topic];
  return <span className={`blog-chip blog-chip--${tone}`}>{label}</span>;
}

export function PostMeta({ post }: { post: Post }) {
  return (
    <div className="blog-meta">
      <TopicChip topic={post.topic} />
      <span className="blog-meta__time">{post.readingMinutes} min read</span>
    </div>
  );
}

export function AuthorLine({ author, date }: { author: AuthorId; date?: string }) {
  const a = AUTHORS[author];
  return (
    <div className="blog-author">
      <span className="blog-author__avatar" aria-hidden="true">
        {a.initials}
      </span>
      <span className="blog-author__text">
        <span className="blog-author__name">
          {a.name} <span className="blog-author__role">· {a.role}, {a.credit}</span>
        </span>
        {date && <span className="blog-author__date">{date}</span>}
      </span>
    </div>
  );
}

/** The app's "Pro Tips" card, turned into the blog's call to action. */
export function CheckTip({ className = "" }: { className?: string }) {
  return (
    <aside className={`blog-tip ${className}`.trim()} aria-label="Free ATS check">
      <span className="blog-tip__badge">Free ATS check</span>
      <p className="blog-tip__title">See what an ATS reads from your CV</p>
      <p className="blog-tip__text">No account. Your file stays in your browser.</p>
      <a className="blog-tip__link" href={CHECK_HREF}>
        Check my CV
        <Chevron />
      </a>
      <TipsBulb className="blog-tip__bulb" size={112} />
    </aside>
  );
}

export function Spotlight({ post }: { post: Post }) {
  const href = postHref(post.slug);
  return (
    <article className="blog-spot">
      {/* The title below is the link people and screen readers use; the cover is a second, bigger target. */}
      <a className="blog-spot__cover" href={href} tabIndex={-1} aria-hidden="true">
        <PostCover cover={post.cover} size="hero" />
      </a>
      <PostMeta post={post} />
      <h2 className="blog-spot__title">
        <a href={href}>{post.title}</a>
      </h2>
      <p className="blog-spot__dek">{post.dek}</p>
      <AuthorLine author={post.author} />
    </article>
  );
}

export function LatestList({ posts }: { posts: Post[] }) {
  return (
    <section className="blog-latest" aria-labelledby="blog-latest-title">
      <h2 className="blog-latest__title" id="blog-latest-title">
        Latest
      </h2>
      <ul className="blog-latest__list">
        {posts.map((post) => (
          <li key={post.slug}>
            <a className="blog-latest__item" href={postHref(post.slug)}>
              <PostCover cover={post.cover} size="thumb" />
              <span className="blog-latest__text">
                <span className="blog-latest__name">{post.title}</span>
                <span className="blog-latest__meta">
                  {TOPICS[post.topic].label} · {post.readingMinutes} min read
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="blog-card">
      <a className="blog-card__link" href={postHref(post.slug)}>
        <PostCover cover={post.cover} size="card" />
        <span className="blog-card__body">
          <TopicChip topic={post.topic} />
          <h3 className="blog-card__title">{post.title}</h3>
          <span className="blog-card__dek">{post.dek}</span>
          <span className="blog-card__time">{post.readingMinutes} min read</span>
        </span>
      </a>
    </article>
  );
}

/** The landing's upload card on a mint band, with what the check does next to it. */
export function CheckBand() {
  const rows = [
    {
      title: "Field by field",
      text: "Name, contacts, jobs with their dates, degrees and skills, as two text readers take them out of your file.",
      icon: (
        <path d="M9 6h11M9 12h11M9 18h11M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
      ),
    },
    {
      title: "Problems, from critical to a tip",
      text: "Each one says why it matters and how to fix it. No score.",
      icon: (
        <>
          <path d="M12 3 2.5 20h19Z" />
          <path d="M12 10v4M12 17h.01" />
        </>
      ),
    },
    {
      title: "Nothing uploaded",
      text: "The file is read in your browser and never sent to us.",
      icon: (
        <>
          <rect x="4" y="10" width="16" height="11" rx="2.5" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      ),
    },
  ];
  return (
    <section className="blog-band" aria-labelledby="blog-band-title">
      <div className="container blog-band__inner">
        <div className="blog-band__card">
          <h2 className="blog-band__title" id="blog-band-title">
            Check how an ATS reads your CV
          </h2>
          <a className="blog-band__drop" href={CHECK_HREF}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M12 15V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
            </svg>
            <span className="blog-band__drop-text">Check a PDF or Word file</span>
          </a>
          <p className="blog-band__note">Free, no account. Your file stays in your browser.</p>
        </div>
        <ul className="blog-band__rows">
          {rows.map((row) => (
            <li className="blog-band__row" key={row.title}>
              <span className="blog-band__icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                  {row.icon}
                </svg>
              </span>
              <span>
                <span className="blog-band__row-title">{row.title}</span>
                <span className="blog-band__row-text">{row.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AuthorBox({ post }: { post: Post }) {
  const a = AUTHORS[post.author];
  return (
    <section className="blog-bio" aria-label="About the author">
      <span className="blog-bio__avatar" aria-hidden="true">
        {a.initials}
      </span>
      <div className="blog-bio__text">
        <p className="blog-bio__label">Written by</p>
        <p className="blog-bio__name">{a.name}</p>
        <p className="blog-bio__about">{a.bio}</p>
        {post.checkedAt && (
          <p className="blog-bio__checked">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Facts checked against their sources on {formatDate(post.checkedAt)}
          </p>
        )}
      </div>
    </section>
  );
}

export function Sources({ post }: { post: Post }) {
  return (
    <section className="blog-sources" aria-labelledby="sources">
      <h2 className="blog-sources__title" id="sources">
        Sources
      </h2>
      <ol className="blog-sources__list">
        {post.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
