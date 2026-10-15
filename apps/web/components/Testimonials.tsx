"use client";
import { ArrowLeft, ArrowRight } from "./icons";
import { StarSolid } from "./figma-icons";

type Review = {
  name: string;
  text: string;
  time: string;
  avatar?: string;
  letter?: string;
  variant: "tall" | "short";
};

const reviews: Review[] = [
  {
    name: "Stephan",
    avatar: "/images/avatar-stephan-549e4b.png",
    text: "I didn’t expect much, but this tool actually showed me what was wrong with my CV. Fixed a few things, and boom, started getting replies.",
    time: "1 week ago",
    variant: "tall",
  },
  {
    name: "Nickol",
    avatar: "/images/avatar-nickol.png",
    text: "J’ai importé mon CV, reçu un feedback instantané et l’ai amélioré en à peine cinq minutes.",
    time: "1 week ago",
    variant: "tall",
  },
  {
    name: "Ulke",
    letter: "u",
    text: "Das Tool hat mir geholfen, meinen Lebenslauf gezielt an eine bestimmte Stelle anzupassen. Dadurch konnte ich meine Bewerbung mit deutlich mehr Sicherheit abschicken.",
    time: "2 weeks ago",
    variant: "short",
  },
];

export default function Testimonials() {
  return (
    <section className="testimonials" data-figma="testimonials">
      <div className="container testimonials__inner">
        <h2 className="testimonials__title" data-figma="testimonials-title">Our clients' opinions</h2>

        <div className="testimonials__content">
          <div className="testimonials__row">
            {reviews.map((r, i) => (
              <article
                data-figma={`review-${i}`}
                className={`tcard${r.variant === "tall" ? " tcard--tall" : " tcard--short"}${r.name === "Nickol" ? " tcard--center" : ""}`}
                key={r.name}
              >
                <div className="tcard__head">
                  {r.avatar ? (
                    <span className="tcard__avatar-wrap" data-figma={`review-${i}-avatar`}>
                      <img className="tcard__avatar" src={r.avatar} alt={r.name} width={64} height={64} />
                    </span>
                  ) : (
                    <span className="tcard__avatar tcard__avatar--letter" aria-hidden="true" data-figma={`review-${i}-avatar`}>
                      {r.letter}
                    </span>
                  )}
                  <span className="tcard__name" data-figma={`review-${i}-name`}>
                    {r.name}
                  </span>
                </div>

                <div className="tcard__body">
                  <div className="tcard__review">
                    <div className="tcard__stars" aria-label="5 out of 5 stars" data-figma={`review-${i}-stars`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <StarSolid key={i} />
                      ))}
                    </div>
                    <p className="tcard__text">{r.text}</p>
                  </div>
                  <span className="tcard__time" data-figma={`review-${i}-time`}>
                    {r.time}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="testimonials__nav">
            <button className="tnav-btn tnav-btn--muted" type="button" aria-label="Previous" data-figma="reviews-prev">
              <ArrowLeft size={20} />
            </button>
            <button className="tnav-btn" type="button" aria-label="Next" data-figma="reviews-next">
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
