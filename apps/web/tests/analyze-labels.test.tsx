// Improve My Resume and Check Job Fit: each text field says what goes in it, so nobody pastes the
// CV into the job field (Job Fit has two fields that used to share the label "INSERT TEXT").
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";

vi.mock("@/lib/router", () => ({ useNavigate: () => () => {} }));
vi.mock("@/components/app/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => children }));

import AnalyzePage from "@/views/AnalyzePage";

const labels = (mode: "improve" | "jobfit") =>
  [...renderToStaticMarkup(createElement(AnalyzePage, { mode })).matchAll(/<label class="field__label"[^>]*>([^<]*)<\/label>/g)].map(
    (m) => m[1],
  );

describe("the analyze fields' labels", () => {
  it("Improve: one field, for the CV", () => {
    expect(labels("improve")).toEqual(["INSERT TEXT — YOUR CV"]);
  });

  it("Job Fit: the CV field and the job description field are named apart", () => {
    expect(labels("jobfit")).toEqual(["INSERT TEXT — YOUR CV", "INSERT TEXT — JOB DESCRIPTION"]);
  });
});
