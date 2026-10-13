"use client";
import { GaugeIcon, StepIcon, UploadRounded, UserRoundIcon } from "./figma-icons";

const features = [
  {
    Icon: StepIcon,
    size: 40,
    title: "Guidance at every step",
    body: "Fill in your CV using a clear, guided structure, use role-specific examples, and receive tips and real-time recommendations to improve your content.",
  },
  {
    Icon: GaugeIcon,
    size: 43,
    title: "In-depth analysis",
    body: "The system evaluates your CV like a recruiter and ATS, providing insights, prioritized recommendations, and explanations while highlighting strengths and areas for improvement.",
  },
  {
    Icon: UserRoundIcon,
    size: 41,
    title: "Personalized approach",
    body: "Use flexible sections and blocks tailored to your needs, customize your CV for different roles in minutes, and import or export PDF/DOC files easily.",
  },
];

export default function Features() {
  return (
    <section className="features" data-figma="features">
      <div className="container features__grid">
        <div>
          <h2 className="features__title" data-figma="features-title">
            We have everything you need to pass the first screening
          </h2>
          <div className="upload-card" data-figma="features-upload">
            <h3 className="upload-card__title" data-figma="features-upload-title">Check your resume ATS score now</h3>
            <div className="upload-card__drop" data-figma="features-drop">
              <UploadRounded size={42} />
              <span className="upload-card__hint">Upload a file in PDF format</span>
            </div>
          </div>
        </div>

        <div className="feature-list">
          {features.map(({ Icon, size, title, body }, i) => (
            <div className="feature" key={title} data-figma={`feature-${i}`}>
              <div className="feature__icon" data-figma={`feature-${i}-icon`}>
                {/* glyph sizes of the flattened Figma icons (33×33, 40×36, 30×34) */}
                <Icon size={size} />
              </div>
              <div>
                <h3 className="feature__title" data-figma={`feature-${i}-title`}>
                  {title}
                </h3>
                <p className="feature__body">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
