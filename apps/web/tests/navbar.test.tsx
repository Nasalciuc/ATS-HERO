// The header's "Our tool" opens the app (the CV builder) instead of scrolling the landing page.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

vi.mock("@clerk/nextjs", () => ({ Show: () => null, UserButton: () => null }));
vi.mock("@/components/modals/SignInModal", () => ({ default: () => null }));
vi.mock("@/lib/clerk-config", () => ({ isClerkPublicConfigured: () => false }));

import Navbar from "@/components/Navbar";

describe("header", () => {
  it("“Our tool” links to the builder, as a real link crawlers and new tabs can follow", () => {
    const html = renderToStaticMarkup(createElement(Navbar));
    const link = html.match(/<a [^>]*data-figma="nav-tool"[^>]*>Our tool<\/a>/);
    expect(link?.[0]).toContain('href="/app/create"');
  });
});
