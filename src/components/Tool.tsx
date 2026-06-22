import { useNavigate } from "react-router-dom";
import { ChevronDown } from "./icons";

const cards = [
  {
    img: "/images/flow-create-2433fb.png",
    desc: "Build a professional CV with guided structure and recruiter-approved expert recommendations at every step.",
    cta: "Create ATS Resume",
    to: "/app/create",
  },
  {
    img: "/images/flow-improve-7e14af.png",
    desc: "Upload your CV to receive instant feedback, clarity score, and personalized improvement recommendations.",
    cta: "Improve My Resume",
    to: "/app/improve",
  },
  {
    img: "/images/flow-jobfit-7e14af.png",
    desc: "Compare your CV to a job and get match score, skill gap insights, and actionable optimization tips for better results.",
    cta: "Check Job Fit",
    to: "/app/jobfit",
  },
];

export default function Tool() {
  const navigate = useNavigate();
  return (
    <section className="tool" id="tool">
      <div className="container">
        <h2 className="tool__title">One tool. Three career superpowers.</h2>
        <div className="tool__grid">
          {cards.map((card) => (
            <article className="tool__card" key={card.cta}>
              <div className="tool__img">
                <img src={card.img} alt={card.cta} />
              </div>
              <p className="tool__desc">{card.desc}</p>
              <div className="tool__actions">
                <button className="btn btn--white" onClick={() => navigate(card.to)}>{card.cta}</button>
                <button className="btn btn--outline-light">
                  How it works
                  <ChevronDown size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
