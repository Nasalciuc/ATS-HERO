// The apply engine's rules, with a fake agent-browser that records every command: where it refuses to
// go, when it hands over to the person, what it does before the approval and what only the approval
// unlocks. The same engine runs against a real browser in the apply lab (tests/apply-lab).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { abandonApplication, blockerIn, prepareApplication, submitApplication, type Prepared } from "@/lib/apply/engine";
import { applyProfile, type ApplyProfile } from "@/lib/apply/profile";
import type { Answers } from "@/lib/apply/plan";
import { AGENT_BROWSER_VERSION, type Runner, type RunnerOptions } from "@/lib/apply/runner";
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
  - option "Select…" [selected, ref=e12]
  - option "Job board" [ref=e13]
- checkbox "I agree to the privacy notice" [checked=false, required, ref=e7]
- button "Submit application" [ref=e8]
`;
// the same form after the person's answers went in
const ANSWERED = FORM.replace('ref=e5]: Select…', 'ref=e5]: No').replace('checked=false, required, ref=e7', 'checked=true, required, ref=e7');
const POSTING = "Data Analyst\nOnce your application has been received, we reply within a week.";

interface Pages {
  snapshot: string;
  /** the form read again before the click; default: ANSWERED */
  reread?: string;
  /** after the click */
  afterSnapshot?: string;
  afterText?: string;
  resumeInput?: boolean;
  /** a command that fails, after the click */
  failAfterClick?: string;
}

/** A fake agent-browser: answers each command from `pages`, records every call and how it was sent. */
function fake(pages: Pages) {
  const calls: { via: "run" | "batch"; args: string[] }[] = [];
  const opts: RunnerOptions[] = [];
  let clicked = false;
  let snapshots = 0;
  const one = (args: string[]): Record<string, unknown> => {
    const cmd = args.find((a) => !a.startsWith("--")) ?? "";
    if (clicked && cmd === pages.failAfterClick) throw new Error(`${cmd} failed`);
    if (cmd === "snapshot") return { snapshot: clicked ? (pages.afterSnapshot ?? "") : snapshots++ === 0 ? pages.snapshot : (pages.reread ?? ANSWERED) };
    if (cmd === "get") return { text: clicked ? (pages.afterText ?? "") : POSTING };
    if (cmd === "eval") return { result: pages.resumeInput ?? true };
    if (cmd === "click" && args.includes("@e8")) clicked = true;
    return {};
  };
  const runner = (_session: string, o: RunnerOptions): Runner => {
    opts.push(o);
    return {
      run: async (args) => {
        calls.push({ via: "run", args });
        return one(args);
      },
      batch: async (cmds) =>
        cmds.map((args) => {
          calls.push({ via: "batch", args });
          return one(args);
        }),
    };
  };
  const verbs = () => calls.map((c) => c.args.find((a) => !a.startsWith("--")));
  const args = () => calls.map((c) => c.args);
  return { runner, calls, opts, verbs, args };
}

const LAB = "http://127.0.0.1:9/job.html";
const prepare = (f: ReturnType<typeof fake>, p: ApplyProfile = profile) =>
  prepareApplication({ url: LAB, profile: p, cvPdfPath: "/tmp/cv.pdf", allowLocal: true, runner: f.runner, plan: { sourceAnswers: ["Job board"] } });

function ready(r: Prepared) {
  if (r.status !== "ready") throw new Error(`expected a filled form, got ${r.status}`);
  return r;
}
const approve = (r: { session: { name: string }; digest: string }, answers: Answers) => ({ confirmedByPerson: true as const, session: r.session.name, digest: r.digest, answers });

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
    const r = ready(await prepare(f));
    expect(f.opts).toEqual([{ allowedDomains: ["127.0.0.1"] }]);
    expect(f.args()[0]).toEqual(["open", LAB]);
    expect(f.calls).toContainEqual({ via: "batch", args: ["fill", "@e1", "Ana"] });
    expect(f.calls).toContainEqual({ via: "batch", args: ["fill", "@e3", profile.email] });
    expect(f.calls).toContainEqual({ via: "batch", args: ["select", "@e6", "Job board"] });
    expect(f.calls).toContainEqual({ via: "batch", args: ["upload", "[data-ats-hero-resume]", "/tmp/cv.pdf"] });
    // before the approval: no click at all, the sponsorship question and the consent untouched
    expect(f.verbs()).not.toContain("click");
    expect(f.verbs()).not.toContain("check");
    expect(f.args().some((c) => c.includes("@e5") || c.includes("@e7"))).toBe(false);
    expect(r.resumeAttached).toBe(true);
    expect(r.digest).toMatch(/^[0-9a-f]{32}$/);
    expect(r.plan.person.map((p) => [p.label, p.sensitive])).toEqual([
      ["Will you now or in the future require visa sponsorship?", true],
      ["I agree to the privacy notice", true],
    ]);
  });

  it("types what comes from the CV only through a batch: a value is never read as a flag", async () => {
    const f = fake({ snapshot: FORM });
    ready(await prepare(f, { ...profile, firstName: "--headed" }));
    expect(f.calls).toContainEqual({ via: "batch", args: ["fill", "@e1", "--headed"] });
    expect(f.calls.filter((c) => c.via === "run").some((c) => c.args.includes("--headed") || c.args.includes(profile.email))).toBe(false);
  });

  it("says when the CV couldn't be attached", async () => {
    const f = fake({ snapshot: FORM, resumeInput: false });
    expect(ready(await prepare(f)).resumeAttached).toBe(false);
    expect(f.verbs()).not.toContain("upload");
  });

  it("hands over at a CAPTCHA, an e-mailed code, a login or a field it can't set, without filling anything", async () => {
    for (const [page, reason] of [
      [`- Iframe "recaptcha challenge expires in two minutes"\n${FORM}`, "captcha"],
      [`- Iframe "Widget containing checkbox for hCaptcha security challenge"\n${FORM}`, "captcha"],
      [`- StaticText "Enter the code we sent to your e-mail"\n- textbox "Code" [ref=e1]`, "email_code"],
      [`- heading "Sign in to apply" [ref=e1]`, "login"],
      [`- textbox "Email" [ref=e1]\n- textbox "Password" [ref=e2]\n- button "Submit application" [ref=e3]`, "login"],
      [`${FORM}- Date "Earliest start date"\n  - spinbutton "Month Month" [ref=e20]: 0\n`, "unsupported_field"],
    ] as const) {
      const f = fake({ snapshot: page });
      expect(await prepare(f)).toMatchObject({ status: "handoff", reason, url: LAB });
      expect(f.verbs()).not.toContain("fill");
      expect(f.verbs()).toContain("close");
    }
  });

  it("reads challenges from the page's controls, not from the posting's text", () => {
    expect(blockerIn(`- Iframe "reCAPTCHA"\n- StaticText "This site is protected by reCAPTCHA"`)).toBeNull();
    expect(blockerIn(`- paragraph\n  - StaticText "You will pass a security check. Verify you are human at the interview."\n${FORM}`)).toBeNull();
  });

  it("a page without a form to send is handed over", async () => {
    const f = fake({ snapshot: `- heading "Data Analyst" [level=1, ref=e1]\n- link "Apply on company site" [ref=e2]` });
    expect(await prepare(f)).toMatchObject({ status: "handoff", reason: "no_form" });
  });
});

describe("sending", () => {
  async function prepared(pages: Omit<Pages, "snapshot"> = {}) {
    const f = fake({ snapshot: FORM, afterText: "Thank you for applying! We have received your application.", ...pages });
    const r = ready(await prepare(f));
    f.calls.length = 0;
    return { f, r };
  }
  const OK = { q1: "No", q2: true };

  it("never without the person's approval", async () => {
    const { f, r } = await prepared();
    // @ts-expect-error: the approval is required by the type too
    await expect(submitApplication(r.session, { answers: OK })).rejects.toThrow(/approval/);
    expect(f.calls).toEqual([]);
  });

  it("never on an approval for another application, or for a plan the person wasn't shown", async () => {
    const { f, r } = await prepared();
    await expect(submitApplication(r.session, { ...approve(r, OK), session: "apply-other" })).rejects.toThrow(/another application/);
    await expect(submitApplication(r.session, { ...approve(r, OK), digest: "0".repeat(32) })).rejects.toThrow(/another application/);
    expect(f.calls).toEqual([]);
  });

  it("types and clicks nothing while an item isn't gone through", async () => {
    const { f, r } = await prepared();
    const s = await submitApplication(r.session, approve(r, { q1: "No" }));
    expect(s).toMatchObject({ status: "blocked", reason: "missing" });
    if (s.status === "blocked") expect(s.missing.map((m) => m.label)).toEqual(["I agree to the privacy notice"]);
    expect(f.calls).toEqual([]);
  });

  it("puts in the answers, reads the form again, sends, and reads the confirmation", async () => {
    const { f, r } = await prepared();
    const s = await submitApplication(r.session, approve(r, OK));
    expect(f.calls.slice(0, 5)).toEqual([
      { via: "batch", args: ["select", "@e5", "No"] },
      { via: "batch", args: ["check", "@e7"] },
      { via: "run", args: ["--content-boundaries", "snapshot"] },
      { via: "run", args: ["--content-boundaries", "get", "text", "body"] },
      { via: "run", args: ["click", "@e8"] },
    ]);
    expect(s).toMatchObject({ status: "sent", confirmation: "Thank you for applying" });
    expect(f.verbs().at(-1)).toBe("close");
    // once only
    await expect(submitApplication(r.session, approve(r, OK))).rejects.toThrow(/closed/);
  });

  it("a \"no\" or \"leave it empty\" is put in too: a box unchecked, a choice put back", async () => {
    const pre = FORM.replace("checked=false, required, ref=e7", "checked=true, ref=e7").replace("ref=e6]: Select…", "ref=e6]: Job board");
    const f = fake({ snapshot: pre, reread: ANSWERED.replace("checked=true, required, ref=e7", "checked=false, ref=e7"), afterText: "Thank you for applying!" });
    const r = ready(await prepareApplication({ url: LAB, profile, cvPdfPath: "/tmp/cv.pdf", allowLocal: true, runner: f.runner }));
    const ids = Object.fromEntries(r.plan.person.map((p) => [p.label, p.id]));
    const s = await submitApplication(r.session, approve(r, { [ids["Will you now or in the future require visa sponsorship?"]]: "No", [ids["How did you hear about this job?"]]: "", [ids["I agree to the privacy notice"]]: false }));
    expect(f.calls).toContainEqual({ via: "batch", args: ["uncheck", "@e7"] });
    expect(f.calls).toContainEqual({ via: "batch", args: ["select", "@e6", "Select…"] });
    expect(s.status).toBe("sent");
  });

  it("does not click when the form didn't take an answer", async () => {
    const { f, r } = await prepared({ reread: FORM.replace("ref=e5]: Select…", "ref=e5]: No") });
    expect(await submitApplication(r.session, approve(r, OK))).toMatchObject({ status: "handoff", reason: "unsupported_field", url: LAB });
    expect(f.verbs()).not.toContain("click");
  });

  it("shows a question that appears after an answer, and sends only on a new approval", async () => {
    const { f, r } = await prepared({ reread: `${ANSWERED}- textbox "Which visa do you hold?" [ref=e14]\n` });
    const s = await submitApplication(r.session, approve(r, OK));
    expect(s).toMatchObject({ status: "blocked", reason: "changed" });
    if (s.status !== "blocked" || s.reason !== "changed") return;
    expect(s.missing.map((m) => [m.label, m.sensitive])).toEqual([["Which visa do you hold?", true]]);
    expect(f.verbs()).not.toContain("click");
    // the old approval no longer fits; one for the new plan does
    await expect(submitApplication(r.session, approve(r, OK))).rejects.toThrow(/another application/);
    const again = Object.fromEntries(s.plan.person.map((p) => [p.id, p.kind === "checkbox" ? true : p.kind === "choice" ? "No" : ""]));
    expect(await submitApplication(r.session, approve({ session: r.session, digest: s.digest }, again))).toMatchObject({ status: "sent" });
  });

  it("a confirmation counts only if it is new and the form is gone", async () => {
    let { r } = await prepared({ afterText: `${POSTING}\nPlease correct the errors below.` });
    expect((await submitApplication(r.session, approve(r, OK))).status).toBe("unconfirmed");
    // the posting's own "has been received" is not a confirmation
    ({ r } = await prepared({ afterText: POSTING }));
    expect((await submitApplication(r.session, approve(r, OK))).status).toBe("unconfirmed");
    // nor is a "thank you" while the submit button is still there
    ({ r } = await prepared({ afterSnapshot: ANSWERED, afterText: "Thank you for applying!\nYour application was NOT sent." }));
    expect((await submitApplication(r.session, approve(r, OK))).status).toBe("unconfirmed");
  });

  it("hands over at a code asked for after the click", async () => {
    const { r } = await prepared({ afterSnapshot: `- textbox "Verification code" [ref=e1]`, afterText: "Enter the code we sent." });
    expect(await submitApplication(r.session, approve(r, OK))).toMatchObject({ status: "handoff", reason: "email_code", url: LAB });
  });

  it("after the click it never throws: an error is reported as unconfirmed", async () => {
    const { f, r } = await prepared({ failAfterClick: "wait" });
    expect(await submitApplication(r.session, approve(r, OK))).toMatchObject({ status: "unconfirmed", error: "wait failed" });
    expect(f.verbs().at(-1)).toBe("close");
  });

  it("closes the browser when the person says no", async () => {
    const { f, r } = await prepared();
    await abandonApplication(r.session);
    expect(f.args()).toEqual([["close"]]);
    await expect(submitApplication(r.session, approve(r, OK))).rejects.toThrow(/closed/);
  });
});

it("the lab workflow installs the agent-browser version the engine is written for", () => {
  const wf = fs.readFileSync(path.join(process.cwd(), "../../.github/workflows/apply-lab.yml"), "utf8");
  expect(wf).toContain(`agent-browser@${AGENT_BROWSER_VERSION}`);
});
