"use client";
import { Fragment, useState } from "react";
import { MinusThin, PlusThin } from "./figma-icons";
import { FAQS } from "@/lib/faq";

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section className="faq" id="faq" data-figma="faq">
      <div className="container">
        <div className="faq__list" data-figma="faq-list">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className={`faq__item${isOpen ? " is-open" : ""}`} key={item.q} data-figma={`faq-${i}`}>
                <button
                  className="faq__q"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span data-figma={`faq-${i}-q`}>{item.q}</span>
                  <span className="faq__toggle" data-figma={`faq-${i}-toggle`}>{isOpen ? <MinusThin /> : <PlusThin size={34} />}</span>
                </button>
                <div className="faq__a" aria-hidden={!isOpen} inert={!isOpen}>
                  <p className="faq__a-inner" data-figma={`faq-${i}-a`}>
                    {item.a.split("\n").map((part, k) => (
                      <Fragment key={k}>
                        {k > 0 && <br className="faq__br" />}
                        {k > 0 ? ` ${part}` : part}
                      </Fragment>
                    ))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
