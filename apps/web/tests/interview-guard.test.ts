// Interview Trainer, step 5: the checks on what a model says (lib/interview/guard.ts). A quote is the
// person's words; a stronger answer adds no fact; an interviewer's question stays on the work and is
// never rude. Synthetic answers only.
import { describe, expect, it } from "vitest";
import { asksAboutPrivateLife, findQuote, inventedFacts, isRude } from "@/lib/interview/guard";

const ANSWER =
  "So the report took me a lot of time every week, and I wrote some Python to pull the data from the CRM.\n" +
  "Then I make the Power BI file refresh by itself every Monday. Basically I helped the team a lot with this, and they were happy. " +
  "I was responsible of the whole process – it’s “my baby”.";

describe("findQuote", () => {
  it("returns the person's words as they stand in the answer", () => {
    expect(findQuote("I helped the team a lot with this", [ANSWER])).toBe("I helped the team a lot with this");
    expect(findQuote("responsible of", [ANSWER])).toBe("responsible of");
  });

  it("looks past letter case, spacing, the shape of quotes and dashes, and what a model adds at the ends", () => {
    expect(findQuote("then i make the power bi file", [ANSWER])).toBe("Then I make the Power BI file");
    expect(findQuote("from the CRM. Then   I make", [ANSWER])).toBe("from the CRM.\nThen I make");
    expect(findQuote(`"the whole process - it's "my baby"."`, [ANSWER])).toBe("the whole process – it’s “my baby”.");
    expect(findQuote("it's \"my baby\"!", [ANSWER])).toBe("it’s “my baby”");
    expect(findQuote("“they were happy.”", [ANSWER])).toBe("they were happy.");
    expect(findQuote("...every Monday…", [ANSWER])).toBe("every Monday");
  });

  it("finds it in whichever answer has it", () => {
    expect(findQuote("about 12 hours", ["I automated it.", "It saved about 12 hours a week."])).toBe("about 12 hours");
  });

  it("refuses words the person didn't say, and words stitched from two places", () => {
    expect(findQuote("I saved the team 6 hours", [ANSWER])).toBeNull();
    expect(findQuote("I wrote some Python … every Monday", [ANSWER])).toBeNull();
    expect(findQuote("I automated it. It saved", ["I automated it.", "It saved about 12 hours a week."])).toBeNull();
    // whole words only
    expect(findQuote("he team a lot", [ANSWER])).toBeNull();
    expect(findQuote("the team a lo", [ANSWER])).toBeNull();
    expect(findQuote("the report", ["It was in the reports. Then the report changed."])).toBe("the report");
    expect(findQuote("", [ANSWER])).toBeNull();
    expect(findQuote("a", [ANSWER])).toBeNull();
    expect(findQuote("...", [ANSWER])).toBeNull();
  });
});

describe("inventedFacts", () => {
  const sources = [
    "Tell me about when you automated a weekly reconciliation workflow in Python.",
    "I wrote a script that pulls the data from the bank export and the ledger and matches them. It took me most of Monday before, now it runs by itself.",
    "It went from twelve hours to about one, and the finance team stopped checking by hand.",
    "Automated a weekly reconciliation workflow in Python, saving 12 hours per week.",
    "Data Analyst", "Flutterwave", "Altamira Tech",
  ];

  it("finds nothing in an answer built from what was said and the CV line", () => {
    const stronger =
      "At Flutterwave, the weekly reconciliation took me most of Monday. I owned it, so I automated it: I wrote a Python script that pulls " +
      "the data from the bank export and the ledger and matches them. Now it runs by itself, and it went from 12 hours to about 1. " +
      "The finance team stopped checking by hand.";
    expect(inventedFacts(stronger, sources)).toEqual([]);
  });

  it("finds a number that is in neither, however it is written", () => {
    expect(inventedFacts("It saved 40% of the time, about 11 hours.", sources)).toEqual(["40%", "11"]);
    expect(inventedFacts("It saved twelve hours a week.", sources)).toEqual([]);
    expect(inventedFacts("It saved fifteen hours a week.", sources)).toEqual(["15"]);
    // "about one" is 1: people say it without a digit
    expect(inventedFacts("It now takes 1 hour, not 12.", sources)).toEqual([]);
    expect(inventedFacts("It now takes 1 hour, not 12.", sources.filter((s) => !/\bone\b/.test(s)))).toEqual(["1"]);
  });

  it("finds a quantity said without a number", () => {
    expect(inventedFacts("We doubled the speed and cut errors in half.", sources)).toEqual(["doubled", "half"]);
    expect(inventedFacts("Hundreds of rows were matched.", sources)).toEqual(["Hundreds"]);
    expect(inventedFacts("It was twice as fast.", [...sources, "It doubled our speed."])).toEqual([]);
  });

  it("finds a tool the person didn't name, and lets everyday words be words", () => {
    expect(inventedFacts("I wrote it in Python and SQL, with Airflow.", sources)).toEqual(["SQL", "Airflow"]);
    expect(inventedFacts("I used Power BI for it.", sources)).toEqual(["Power BI"]);
    expect(inventedFacts("I had to go through the training data and excel at it.", sources)).toEqual([]);
    expect(inventedFacts("I ran an A/B test on it.", sources)).toEqual(["A/B test"]);
  });

  it("takes a phrase in small letters as new only when its words are new", () => {
    const said = [...sources, "I analysed the data every week."];
    expect(inventedFacts("My data analysis showed the gaps.", said)).toEqual([]);
    expect(inventedFacts("I used machine learning to match them.", said)).toEqual(["machine learning"]);
  });

  it("finds a name that is in neither: a company, a person, a day", () => {
    expect(inventedFacts("At Brightline, I worked with Maria on it every Friday.", sources)).toEqual(["Brightline", "Maria", "Friday"]);
    expect(inventedFacts("At Flutterwave’s finance team, every Monday, I ran it.", sources)).toEqual([]);
    // a capital that only starts a sentence is grammar; an acronym or a mixed-case word is a name anywhere
    expect(inventedFacts("Automating it took a week. Then I showed it.", sources)).toEqual([]);
    expect(inventedFacts("ERP data was the hard part. PowerQuery helped.", sources)).toEqual(["ERP", "PowerQuery"]);
    expect(inventedFacts("I’m sure I did it; I’ve checked.", sources)).toEqual([]);
  });

  it("names each new fact once, as it is written", () => {
    expect(inventedFacts("Tableau, then Tableau again: 30 dashboards, 30 teams.", sources)).toEqual(["30", "Tableau"]);
  });
});

describe("asksAboutPrivateLife", () => {
  it("lets questions about the work through", () => {
    for (const q of [
      "What changed for the team after you automated it?",
      "How did you monitor the health of the pipeline?",
      "How old was the system you replaced?",
      "Which condition in the query caused the slowdown?",
      "How did the union of the two tables perform?",
      "Who was the partner team on the migration?",
      "What did you do when the release left a gap in the data?",
    ]) expect(asksAboutPrivateLife(q), q).toBe(false);
  });

  it("stops questions about age, health, family, religion, origin and leave", () => {
    for (const q of [
      "How old are you, if I may ask?",
      "Was your illness the reason the project slipped?",
      "How did your pregnancy affect the delivery?",
      "Why were you on sick leave last year?",
      "How long were you away from work?",
      "Do you have children at home?",
      "Are you married?",
      "How does your family feel about the travel?",
      "Is your religion a problem for weekend shifts?",
      "What is your nationality?",
      "Where are you originally from?",
      "Tell me about your health during that period.",
      "Can you explain your career gap in 2022?",
      "How did your recovery go?",
      "What’s your accent?",
      "Do you need a visa, given your citizenship?",
    ]) expect(asksAboutPrivateLife(q), q).toBe(true);
  });
});

describe("isRude", () => {
  it("lets a demanding question through and stops an insulting one", () => {
    expect(isRude("That is still vague. What exactly did you change, and by how much?")).toBe(false);
    expect(isRude("Give me the number: how many hours a week did it save?")).toBe(false);
    for (const q of [
      "That was a terrible answer. What did you actually do?",
      "Come on, what did you actually do?",
      "Are you serious? What was the result?",
      "Is your poor English the reason this is unclear?",
      "That's nonsense. What happened?",
      "Did you even do the work yourself?",
    ]) expect(isRude(q), q).toBe(true);
  });
});
