/* Static résumé mockup used in the hero art (replaces the missing PNG).
   Transcribed from the Figma hero preview (Daniel Gallego — UX Designer). */

const skills = [
  ["Prototyping Tools", "User Research", "Information Architecture"],
  ["Interaction Design", "Visual Design", "Usability Heuristics"],
  ["Accessibility", "Design Thinking", "User Testing Tools"],
];

const experience = [
  {
    role: "Instant Chats App, Nextville Program",
    date: "Jan 2025 - Present",
    bullets: [
      "Led development of an advanced automation system, achieving a 40% increase in operational efficiency.",
      "Streamlined manufacturing processes, reducing production costs by 30% and improving output quality.",
    ],
  },
  {
    role: "Sr. Engineer, Xenodochial Inc.",
    date: "Feb 2021 - Dec 2022",
    bullets: [
      "Implemented a robust control system, enabling a 50% reduction in equipment downtime.",
      "Developed testing and validation routines, ensuring compliance with industry standards.",
    ],
  },
];

const education = [
  {
    title: "Master of Science in Industrial Engineering",
    date: "Aug 2016 - Oct 2018",
    lines: ["University of Engineering UX Cohort", "Major in Automotive Technology"],
  },
  {
    title: "Bachelor of Design in Process Engineering",
    date: "May 2014 - May 2016",
    lines: ["Engineering University", "Coursework in Structural Design and Project Management."],
  },
];

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hres__section">
      <div className="hres__h">{title}</div>
      {children}
    </div>
  );
}

export default function HeroResume() {
  return (
    <div className="hres" aria-hidden="true">
      <div className="hres__name">DANIEL GALLEGO</div>
      <div className="hres__role">UX DESIGNER</div>
      <div className="hres__contact">
        123 Anywhere St., Any City &nbsp;|&nbsp; hello@reallygreatsite.com &nbsp;|&nbsp; www.reallygreatsite.com
      </div>

      <ResumeSection title="SUMMARY">
        <p className="hres__p">
          UX Designer with a focus on delivering impactful results, eager to tackle dynamic challenges and
          apply creativity in self-directed user experiences. Demonstrated proficiency in project management,
          user-centric problem-solving, and seamless collaboration across teams. Skilled in leveraging
          state-of-the-art tools and methodologies to streamline processes and elevate user satisfaction.
        </p>
      </ResumeSection>

      <ResumeSection title="TECHNICAL SKILLS">
        <div className="hres__skills">
          {skills.map((col, i) => (
            <ul key={i}>
              {col.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ))}
        </div>
      </ResumeSection>

      <ResumeSection title="PROFESSIONAL EXPERIENCE">
        {experience.map((e) => (
          <div className="hres__entry" key={e.role}>
            <div className="hres__entry-head">
              <strong>{e.role}</strong>
              <span>{e.date}</span>
            </div>
            <ul className="hres__bullets">
              {e.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </ResumeSection>

      <ResumeSection title="EDUCATION">
        {education.map((e) => (
          <div className="hres__entry" key={e.title}>
            <div className="hres__entry-head">
              <strong>{e.title}</strong>
              <span>{e.date}</span>
            </div>
            {e.lines.map((l) => (
              <div className="hres__sub" key={l}>
                {l}
              </div>
            ))}
          </div>
        ))}
      </ResumeSection>

      <ResumeSection title="ADDITIONAL INFORMATION">
        <p className="hres__p">
          <strong>Languages: </strong>English, French, Mandarin
        </p>
        <p className="hres__p">
          <strong>Certifications: </strong>Professional Design Engineer (PDE), Project Management Tech (PMT)
        </p>
        <p className="hres__p">
          <strong>Awards: </strong>Most Innovative Employee of the Year (2021), Best Employee Division Two (2024)
        </p>
      </ResumeSection>
    </div>
  );
}
