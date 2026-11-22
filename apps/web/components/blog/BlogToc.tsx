"use client";
// "In this guide": the post's sections, with the one being read marked (the last heading that has
// passed the top of the window). Without JavaScript it is a plain list of links.
import { useEffect, useState } from "react";
import type { Heading } from "@/lib/blog/schema";

/** How far below the top of the window a heading counts as reached (the sticky offset plus a margin). */
const READING_LINE = 140;

export default function BlogToc({ items }: { items: Heading[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = items[0]?.id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= READING_LINE) current = item.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [items]);

  return (
    <nav className="blog-toc" aria-labelledby="blog-toc-title">
      <p className="blog-toc__label" id="blog-toc-title">
        In this guide
      </p>
      <ol className="blog-toc__list">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id}>
              <a
                className={`blog-toc__link${current ? " is-active" : ""}`}
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
