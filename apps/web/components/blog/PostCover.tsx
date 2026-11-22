// A post's cover, drawn from the site's own parts (the landing's CV card, the builder's fields, the
// PDF and Word tiles) instead of stock pictures. The same cover appears on the list and in the post's
// header, so a post looks the same wherever it is linked from. Decorative: the title next to it
// says what the post is about, so screen readers skip it.
import type { Cover } from "@/lib/blog/schema";

type Size = "hero" | "card" | "thumb";

function CvCard() {
  return <img className="blog-cover__cv" src="/images/hero-cv-card.png" alt="" width={778} height={1104} />;
}

function FileTile({ label, tone }: { label: string; tone: "violet" | "green" }) {
  return (
    <span className={`blog-cover__file blog-cover__file--${tone}`}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8Z" />
        <path d="M14 3v5h5" />
        <path d="M12 11v6" />
        <path d="m9.5 14.5 2.5 2.5 2.5-2.5" />
      </svg>
      {label}
    </span>
  );
}

const FIELDS = [
  { label: "Name, surname", value: "Daniel Gallego" },
  { label: "Experience", value: "2 jobs, dates read" },
  { label: "Skills", value: "9 skills found" },
];

function ScoreCover({ size }: { size: Size }) {
  return (
    <>
      <CvCard />
      {size === "card" && <span className="blog-cover__tag">No score</span>}
      {size === "hero" && (
        <>
          <span className="blog-cover__note blog-cover__note--top">
            <span className="blog-cover__label">Without a job post</span>
            <span className="blog-cover__big">No score</span>
            <span className="blog-cover__small">The ATS only reads your CV into a profile.</span>
          </span>
          <span className="blog-cover__note blog-cover__note--bottom">
            <span className="blog-cover__label">Against one job</span>
            <span className="blog-cover__pills">
              <span className="blog-cover__pill blog-cover__pill--mint">A–D grade</span>
              <span className="blog-cover__pill blog-cover__pill--violet">Strong Match</span>
              <span className="blog-cover__pill blog-cover__pill--stars">★★★☆</span>
            </span>
          </span>
        </>
      )}
    </>
  );
}

function FieldsCover({ size }: { size: Size }) {
  return (
    <span className="blog-cover__center">
      {size === "thumb" ? (
        <span className="blog-cover__tick">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" focusable="false">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
      ) : (
        <span className="blog-cover__form">
          {FIELDS.map((field) => (
            <span className="blog-cover__field" key={field.label}>
              <span className="blog-cover__field-label">{field.label}</span>
              <span className="blog-cover__field-value">
                {field.value}
                <span className="blog-cover__check">✓</span>
              </span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function FormatsCover({ size }: { size: Size }) {
  return (
    <span className="blog-cover__center">
      {size === "thumb" ? (
        <>
          <span className="blog-cover__chip">PDF</span>
          <span className="blog-cover__chip blog-cover__chip--mint">DOCX</span>
        </>
      ) : (
        <>
          <FileTile label="PDF" tone="violet" />
          <FileTile label="DOCX" tone="green" />
        </>
      )}
    </span>
  );
}

export default function PostCover({ cover, size }: { cover: Cover; size: Size }) {
  return (
    <span className={`blog-cover blog-cover--${cover} blog-cover--${size}`} aria-hidden="true">
      {cover === "score" && <ScoreCover size={size} />}
      {cover === "fields" && <FieldsCover size={size} />}
      {cover === "formats" && <FormatsCover size={size} />}
    </span>
  );
}
