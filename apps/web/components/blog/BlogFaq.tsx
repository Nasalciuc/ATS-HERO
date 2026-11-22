"use client";
// A post's questions, in the landing's FAQ look (the violet round toggle), one open at a time.
// Closed answers stay in the HTML (hidden), so search engines and AI crawlers read all of them.
import { useState } from "react";
import { MinusThin, PlusThin } from "@/components/figma-icons";

export default function BlogFaq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="blog-faq">
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `blog-faq-${i}`;
        return (
          <div className={`blog-faq__item${isOpen ? " is-open" : ""}`} key={item.q}>
            <h3 className="blog-faq__heading">
              <button
                type="button"
                className="blog-faq__q"
                aria-expanded={isOpen}
                aria-controls={id}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span>{item.q}</span>
                <span className="blog-faq__toggle" aria-hidden="true">
                  {isOpen ? <MinusThin size={24} /> : <PlusThin size={24} />}
                </span>
              </button>
            </h3>
            <div className="blog-faq__a" id={id} hidden={!isOpen}>
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
