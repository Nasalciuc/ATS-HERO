// Crawlers that don't run JavaScript (most AI search bots) read the hero heading as raw text. Its
// two lines are separate display:block spans, so without a real space between them the heading
// reads "whowe’re". The space never renders (whitespace between blocks), so Figma is unaffected.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("@/lib/router", () => ({ useNavigate: () => () => {} }));

import Hero from "@/components/Hero";

describe("hero heading", () => {
  it("reads as one sentence in the HTML", () => {
    const html = renderToStaticMarkup(createElement(Hero));
    const h1 = html.match(/<h1[\s\S]*?<\/h1>/)![0].replace(/<[^>]+>/g, "");
    expect(h1).toBe("You’re exactly who we’re looking for");
  });
});
