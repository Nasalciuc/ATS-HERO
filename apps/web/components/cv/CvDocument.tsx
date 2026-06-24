"use client";
import type { CvData } from "../../lib/types";

const STYLE_ACCENT: Record<number, string> = {
  1: "#E6E1FF",
  2: "#D6F7E2",
  3: "#E3E2E2",
  4: "#FFE9D6",
  5: "#DCE9FF",
  6: "#F6D6E8",
};

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="cvdoc__section">
      <div className="cvdoc__bar" style={{ background: accent }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function CvDocument({ data, styleId = 1 }: { data: CvData; styleId?: number }) {
  const accent = STYLE_ACCENT[styleId] ?? STYLE_ACCENT[1];
  const p = data.personalInfo;
  const contactLine = [p.cityState || p.country, p.email, p.phone].filter(Boolean).join("  ·  ");

  return (
    <div className="cvdoc">
      <div className="cvdoc__name">{p.name || "Your Name"}</div>
      <div className="cvdoc__role">{data.summary.position || "Target Role"}</div>
      {contactLine && <div className="cvdoc__contact">{contactLine}</div>}
      {(p.linkedin || p.website) && (
        <div className="cvdoc__contact">{[p.linkedin, p.website].filter(Boolean).join("  ·  ")}</div>
      )}

      {data.summary.valueProposition && (
        <Section title="SUMMARY" accent={accent}>
          <p className="cvdoc__text">{data.summary.valueProposition}</p>
        </Section>
      )}

      {(data.skills.length > 0 ||
        data.instruments.length > 0 ||
        data.softSkills.length > 0 ||
        data.languages.length > 0) && (
        <Section title="SKILLS" accent={accent}>
          {data.skills.length > 0 && (
            <p className="cvdoc__text"><strong>Hard skills: </strong>{data.skills.join(" · ")}</p>
          )}
          {data.instruments.length > 0 && (
            <p className="cvdoc__text"><strong>Tools: </strong>{data.instruments.join(" · ")}</p>
          )}
          {data.softSkills.length > 0 && (
            <p className="cvdoc__text"><strong>Soft skills: </strong>{data.softSkills.join(" · ")}</p>
          )}
          {data.languages.length > 0 && (
            <p className="cvdoc__text">
              <strong>Languages: </strong>
              {data.languages
                .filter((l) => l.name.trim())
                .map((l) => `${l.name}${l.level ? ` (${l.level})` : ""}`)
                .join(" · ")}
            </p>
          )}
        </Section>
      )}

      {data.work.length > 0 && (
        <Section title="PROFESSIONAL EXPERIENCE" accent={accent}>
          {data.work.map((w) => (
            <div className="cvdoc__entry" key={w.id}>
              <div className="cvdoc__entry-head">
                <strong>{w.role || "Role"}{w.company ? `, ${w.company}` : ""}</strong>
                <span>{[w.startDate, w.current ? "Present" : w.endDate].filter(Boolean).join(" – ")}</span>
              </div>
              {w.description && <p className="cvdoc__text">{w.description}</p>}
            </div>
          ))}
        </Section>
      )}

      {data.education.length > 0 && (
        <Section title="EDUCATION" accent={accent}>
          {data.education.map((e) => (
            <div className="cvdoc__entry" key={e.id}>
              <div className="cvdoc__entry-head">
                <strong>{e.degree || "Degree"}{e.institution ? `, ${e.institution}` : ""}</strong>
                <span>{[e.startDate, e.endDate].filter(Boolean).join(" – ")}</span>
              </div>
              {e.additional && <p className="cvdoc__text">{e.additional}</p>}
            </div>
          ))}
        </Section>
      )}

      {(data.awards.length > 0 ||
        data.certifications.length > 0 ||
        data.publications.length > 0 ||
        data.volunteering.length > 0 ||
        data.activities.length > 0) && (
        <Section title="ADDITIONAL INFORMATION" accent={accent}>
          {[
            ["Awards", data.awards],
            ["Certifications", data.certifications],
            ["Publications", data.publications],
            ["Volunteering", data.volunteering],
            ["Activities", data.activities],
          ].map(([label, list]) => {
            const items = list as CvData["awards"];
            if (items.length === 0) return null;
            return (
              <p className="cvdoc__text" key={label as string}>
                <strong>{label as string}: </strong>
                {items.map((i) => i.title).filter(Boolean).join(", ")}
              </p>
            );
          })}
        </Section>
      )}
    </div>
  );
}
