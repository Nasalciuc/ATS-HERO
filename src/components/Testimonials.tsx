import { Star, ArrowLeft, ArrowRight } from "./icons";

type Review = {
  name: string;
  text: string;
  time: string;
  avatar?: string;
  letter?: string;
};

const reviews: Review[] = [
  {
    name: "Stephan",
    avatar: "/images/avatar-stephan-549e4b.png",
    text: "I didn’t expect much, but this tool actually showed me what was wrong with my CV. Fixed a few things, and boom, started getting replies.",
    time: "1 week ago",
  },
  {
    name: "Nickol",
    avatar: "/images/avatar-nickol.png",
    text: "J’ai importé mon CV, reçu un feedback instantané et l’ai amélioré en à peine cinq minutes.",
    time: "1 week ago",
  },
  {
    name: "Ulke",
    letter: "u",
    text: "Das Tool hat mir geholfen, meinen Lebenslauf gezielt an eine bestimmte Stelle anzupassen. Dadurch konnte ich meine Bewerbung mit deutlich mehr Sicherheit abschicken.",
    time: "2 weeks ago",
  },
];

export default function Testimonials() {
  return (
    <section className="testimonials">
      <div className="container">
        <h2 className="testimonials__title">Our clients' opinions</h2>

        <div className="testimonials__row">
          {reviews.map((r) => (
            <article className="tcard" key={r.name}>
              <div className="tcard__head">
                {r.avatar ? (
                  <img className="tcard__avatar" src={r.avatar} alt={r.name} />
                ) : (
                  <span className="tcard__avatar tcard__avatar--letter">{r.letter}</span>
                )}
                <span className="tcard__name">{r.name}</span>
              </div>
              <div className="tcard__stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={22} />
                ))}
              </div>
              <p className="tcard__text">{r.text}</p>
              <span className="tcard__time">{r.time}</span>
            </article>
          ))}
        </div>

        <div className="testimonials__nav">
          <button className="tnav-btn tnav-btn--muted" aria-label="Previous">
            <ArrowLeft />
          </button>
          <button className="tnav-btn" aria-label="Next">
            <ArrowRight />
          </button>
        </div>
      </div>
    </section>
  );
}
