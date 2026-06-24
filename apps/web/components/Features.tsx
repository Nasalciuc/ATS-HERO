"use client";
import { Upload, FeatureSteps, FeatureGauge, FeatureUser } from "./icons";

const features = [
  {
    Icon: FeatureSteps,
    title: "Guidance at every step",
    body: "Fill in your CV using a clear, guided structure, use role-specific examples, and receive tips and real-time recommendations to improve your content.",
  },
  {
    Icon: FeatureGauge,
    title: "In-depth analysis",
    body: "The system evaluates your CV like a recruiter and ATS, providing insights, prioritized recommendations, and explanations while highlighting strengths and areas for improvement.",
  },
  {
    Icon: FeatureUser,
    title: "Personalized approach",
    body: "Use flexible sections and blocks tailored to your needs, customize your CV for different roles in minutes, and import or export PDF/DOC files easily.",
  },
];

export default function Features() {
  return (
    <section className="features">
      <div className="container features__grid">
        <div>
          <h2 className="features__title">
            We have everything you need to pass the first screening
          </h2>
          <div className="upload-card">
            <h3 className="upload-card__title">Check your resume ATS score now</h3>
            <div className="upload-card__drop">
              <Upload size={42} />
              <span className="upload-card__hint">Upload a file in PDF format</span>
            </div>
          </div>
        </div>

        <div className="feature-list">
          {features.map(({ Icon, title, body }) => (
            <div className="feature" key={title}>
              <div className="feature__icon">
                <Icon />
              </div>
              <div>
                <h3 className="feature__title">{title}</h3>
                <p className="feature__body">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
