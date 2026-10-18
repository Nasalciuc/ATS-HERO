// The landing page's JSON-LD is read by crawlers, never by people, so nothing else would notice it
// going wrong. These checks keep it valid and honest:
// - it is valid JSON that can't break out of its <script> tag;
// - the FAQPage carries exactly the questions and answers the page shows (same list, lib/faq.ts);
// - no ratings, reviews or prices that the page and the Terms don't state;
// - it is rendered by the home page only, never by the app.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import JsonLd from "@/components/JsonLd";
import { FAQS, faqAnswerText } from "@/lib/faq";
import { SITE_URL } from "@/lib/site";
import { OFFER_PRICE, homeJsonLd, serializeJsonLd } from "@/lib/structured-data";

const WEB = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), "utf8");

type Node = Record<string, unknown> & { "@type": string };
const graph = () => homeJsonLd()["@graph"] as Node[];
const byType = (type: string) => graph().find((n) => n["@type"] === type)!;

describe("home JSON-LD", () => {
  it("renders one ld+json data block whose content parses back to the same object", () => {
    const html = renderToStaticMarkup(createElement(JsonLd, { data: homeJsonLd() }));
    const match = html.match(/^<script type="application\/ld\+json">([\s\S]*)<\/script>$/);
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(homeJsonLd());
  });

  it("escapes < so a string can't close the script tag", () => {
    const data = { ...homeJsonLd(), "@graph": [{ "@type": "Thing", name: "</script><script>alert(1)</script>" }] };
    const out = serializeJsonLd(data);
    expect(out).not.toContain("<");
    expect(JSON.parse(out)["@graph"][0].name).toBe("</script><script>alert(1)</script>");
  });

  it("describes the organization, the site and the app on the canonical origin", () => {
    expect(graph().map((n) => n["@type"])).toEqual(["Organization", "WebSite", "WebApplication", "FAQPage"]);
    for (const node of graph()) expect(String(node["@id"])).toMatch(new RegExp(`^${SITE_URL}/#`));
    expect(byType("Organization").url).toBe(`${SITE_URL}/`);
    expect(byType("WebSite").url).toBe(`${SITE_URL}/`);
    expect(fs.existsSync(path.join(WEB, "app/apple-icon.png"))).toBe(true); // the Organization logo
  });

  it("FAQPage mirrors the visible FAQ, question by question", () => {
    const entities = byType("FAQPage").mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    expect(entities.map((e) => e.name)).toEqual(FAQS.map((f) => f.q));
    expect(entities.map((e) => e.acceptedAnswer.text)).toEqual(FAQS.map(faqAnswerText));
    for (const e of entities) expect(e.acceptedAnswer.text).not.toContain("\n");
  });

  it("claims no ratings or reviews (we have none we could mark up)", () => {
    const json = JSON.stringify(homeJsonLd());
    expect(json).not.toMatch(/aggregateRating|"review"|"Review"|ratingValue/);
  });

  it("states the price the Terms state: free during the beta", () => {
    expect(OFFER_PRICE).toBe("0");
    expect(read("views/TermsPage.tsx")).toContain("ATS Hero is free while it is in beta");
  });

  it("is rendered by the home page and nowhere in the app", () => {
    expect(read("app/page.tsx")).toMatch(/<JsonLd data=\{homeJsonLd\(\)\} \/>/);
    const appFiles = fs.readdirSync(path.join(WEB, "app/app"), { recursive: true }) as string[];
    for (const f of appFiles.filter((f) => /\.tsx?$/.test(f))) {
      expect(read(path.join("app/app", f))).not.toContain("JsonLd");
    }
  });
});
