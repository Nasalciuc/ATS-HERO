// The apply engine's rules, with a fake agent-browser that records every command: where it refuses to
// go, when it hands over to the person, what it does before the approval and what only the approval
// unlocks. The same engine runs against a real browser in the apply lab (tests/apply-lab).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { abandonApplication, blockerIn, prepareApplication, submitApplication, type Session } from "@/lib/apply/engine";
import { applyProfile } from "@/lib/apply/profile";
import type { Runner } from "@/lib/apply/runner";
import type { CvData } from "@/lib/types";

const personas = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8"),
) as Record<string, CvData>;
const profile = applyProfile(personas.ana);

const FORM = `
- textbox "First Name *" [required, ref=e1]
- textbox "Last Name *" [required, ref=e2]
- textbox "Email *" [required, ref=e3]
- button "Resume/CV *" [ref=e4]: No file chosen
- combobox "Will you now or in the future require visa sponsorship? *" [expanded=false, required, ref=e5]: Select…
  - option "Select…" [selected, ref=e9]
  - option "Yes" [ref=e10]
  - option "No" [ref=e11]
- combobox "How did you hear about this job?" [expanded=false, ref=e6]: Select…
  - option "Job board" [ref=e12]
- checkbox "I agree to the privacy notice" [checked=false, required, ref=e7]
- button "Submit application" [ref=e8]
`;

/** The command in an argument list: the first word that is neither a flag nor a flag's value. */
function verbOf(args: string[]): string {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--allowed-domains") i++;
    else if (!args[i].startsWith("--")) return args[i];
  }
  return "";
}

/** A fake agent-browser: answers each command from `pages`, records the calls. */
function fake(pages: { snapshot: string; afterSubmit?: string; resumeInput?: boolean }) {
  const calls: string[][] = [];
  let submitted = false;
  const runner = (): Runner => async (args) => {
    calls.push(args);
    const cmd = verbOf(args);
    if (cmd === "snapshot") return { snapshot: pages.snapshot };
    if (cmd === "eval") return { result: pages.resumeInput ?? true };
    if (cmd === "click" && args.includes("@e8")) submitted = true;
    if (cmd === "get") return { text: submitted ? pages.afterSubmit ?? "" : pages.snapshot };
    return {};
  };
  const verbs = () => calls.map(verbOf);
  return { runner, calls, verbs };
}

const LAB = "http://127.0.0.1:9/job.html";

describe("before any browser starts", () => {
  it("refuses LinkedIn, Workday and unknown sites without starting one", async () => {
    const f = fake({ snapshot: FORM });
    for (const url of ["https://www.linkedin.com/jobs/view/1", "https://x.wd3.myworkdayjobs.com/a/job/1", "https://careers.example.com/1"]) {
      const r = await prepareApplication({ url, profile, cvPdfPath: "/tmp/cv.pdf", runner: f.runner });
      expect(r.status).toBe("refused");
    }
    expect(f.calls).toEqual([]);
  });

  it("refuses localhost unless the lab asks for it", async () => {
    const f = fake({ snapshot: FORM });
    expect((await prepareApplication({ url: LAB, profile, cvPdfPath: "/tmp/cv.pdf", runner: f.runner })).status).toBe("refused");
    expect(f.calls).toEqual([]);
  });
});

describe("preparing", () => {
  it("opens the posting held to its domains, fills, picks, attaches the CV and stops", async () => {
    const f = fake({ snapshot: FORM });
    const r = await prepareApplication({ url: LAB, profile, cvPdfPath: "/tmp/cv.pdf", allowLocal: true, runner: f.runner });
    expect(r.status).toBe("ready");
    expect(f.calls[0]).toEqual(["--allowed-domains", "127.0.0.1", "open", LAB]);
    expect(f.calls).toContainEqual(["fill", "@e1", "Ana"]);
    expect(f.calls).toContainEqual(["fill", "@e3", profile.email]);
    expect(f.calls).toContainEqual(["select", "@e6", "Job board"]);
    expect(f.calls).toContainEqual(["upload", "[data-ats-hero-resume]", "/tmp/cv.pdf"]);
    // before the approval: no click at all, the sponsorship question and the consent untouched
    expect(f.verbs()).not.toContain("click");
    expect(f.verbs()).not.toContain("check");
    expect(f.calls.some((c) => c.includes("@e5") || c.includes("@e7"))).toBe(false);
    if (r.status === "ready") {
      expect(r.resumeAttached).toBe(true);
      expect(r.plan.person.map((p) => [p.label, p.sensitive])).toEqual([
        ["Will you now or in the future require visa sponsorship?", true],
        ["I agree to the privacy notice", true],
      ]);
    }
  });

  it("says when the CV couldn't be attached", async () => {
    const f = fake({ snapshot: FORM, resumeInput: false });
    const r = await prepareApplication({ url: LAB, profile, cvPdfPath: "/tmp/cv.pdf", allowLocal: true, runner: f.runner });
    expect(r.status === "ready" && r.resumeAttached).toBe(false);
    expect(f.verbs()).not.toContain("upload");
  });

  it("hands over at a CAPTCHA, an e-mailed code or a login, without filling anything", async () => {
    for (const [page, reason] of [
      [`- Iframe "recaptcha challenge expires in two minutes"\n${FORM}`, "captcha"],
      [`- StaticText "Enter the code we sent to your e-mail"\n- textbox "Code" [ref=e1]`, "email_code"],
      [`- heading "Sign in to apply" [ref=e1]`, "login"],
    ] as const) {
      const f = fake({ snapshot: page });
      const r = await prepareApplication({ url: LAB, profile, cvPdfPath: "/tmp/cv.pdf", allowLocal: true, runner: f.runner });
      expect(r).toMatchObject({ status: "handoff", reason });
      expect(f.verbs()).not.toContain("fill");
      expect(f.verbs()).toContain("close");
    }
  });

  it("an invisible reCAPTCHA badge is not a challenge", () => {
    expect(blockerIn(`- Iframe "reCAPTCHA"\n- StaticText "This site is protected by reCAPTCHA"`)).toBeNull();
  });

  it("a page without a form to send is handed over", async () => {
    const f = fake({ snapshot: `- heading "Data Analyst" [level=1, ref=e1]\n- link "Apply on company site" [ref=e2]` });
    expect(await prepareApplication({ url: LAB, profile, cvPdfPath: "/tmp/cv.pdf", allowLocal: true, runner: f.runner })).toMatchObject({ status: "handoff", reason: "no_form" });
  });
});

describe("sending", () => {
  async function ready(afterSubmit = "Thank you for applying! We have received your application.") {
    const f = fake({ snapshot: FORM, afterSubmit });
    const r = await prepareApplication({ url: LAB, profile, cvPdfPath: "/tmp/cv.pdf", allowLocal: true, runner: f.runner });
    if (r.status !== "ready") throw new Error(r.status);
    f.calls.length = 0;
    return { f, session: r.session as Session };
  }

  it("never without the person's approval", async () => {
    const { f, session } = await ready();
    // @ts-expect-error: the approval is required by the type too
    await expect(submitApplication(session, { answers: {} })).rejects.toThrow(/approval/);
    expect(f.calls).toEqual([]);
  });

  it("clicks nothing while a required answer is missing", async () => {
    const { f, session } = await ready();
    const r = await submitApplication(session, { confirmedByPerson: true, answers: { q1: "No" } });
    expect(r.status).toBe("blocked");
    if (r.status === "blocked") expect(r.missing.map((m) => m.label)).toEqual(["I agree to the privacy notice"]);
    expect(f.calls).toEqual([]);
  });

  it("puts in the person's answers, then sends, and reads the confirmation", async () => {
    const { f, session } = await ready();
    const r = await submitApplication(session, { confirmedByPerson: true, answers: { q1: "No", q2: true } });
    expect(f.calls.slice(0, 3)).toEqual([["select", "@e5", "No"], ["check", "@e7"], ["click", "@e8"]]);
    expect(r).toMatchObject({ status: "sent", confirmation: "Thank you for applying" });
    expect(f.verbs()).toContain("close");
  });

  it("says when the page doesn't confirm, or asks for a code after the click", async () => {
    let s = await ready("Please correct the errors below.");
    expect((await submitApplication(s.session, { confirmedByPerson: true, answers: { q1: "No", q2: true } })).status).toBe("unconfirmed");
    s = await ready("Enter the code we sent to your e-mail to finish your application.");
    expect(await submitApplication(s.session, { confirmedByPerson: true, answers: { q1: "No", q2: true } })).toMatchObject({ status: "handoff", reason: "email_code" });
  });

  it("closes the browser when the person says no", async () => {
    const { f, session } = await ready();
    await abandonApplication(session);
    expect(f.calls).toEqual([["close"]]);
  });
});
