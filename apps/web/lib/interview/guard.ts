/**
 * Interview Trainer: what a model says is checked here before a person sees it
 * (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 5). In code on purpose: a rule in a prompt is a request, a
 * check is a guarantee.
 *
 * - **A quote is the person's words** (findQuote): word for word in one of their answers, or the
 *   observation it supports isn't shown (IV-6: every observation with its quote).
 * - **A stronger answer adds no fact** (inventedFacts; IV-7, with the checks of the tailored CV,
 *   APPLY-COPILOT-DESIGN.md §9.2): a number, a quantity, a tool or a name that is in neither what the
 *   person said nor the CV line refuses the whole answer.
 * - **An interviewer's question stays on the work** (asksAboutPrivateLife; B1): never age, health,
 *   family, religion, origin and the like, however the answer got there. And it is never rude
 *   (isRude): Tough insists, it doesn't insult.
 *
 * The last two are short lists of words: a second net under the prompt's rule, not the rule itself.
 * They are wrong on the careful side: a question they refuse by mistake is a follow-up not asked.
 */
import { findSkills } from "@/lib/job-fit";
import { numberKey, numbersIn, spokenNumbers } from "./measure";

/* ── quotes ───────────────────────────────────────────────────────────── */

/** One shape for the marks a model or a keyboard may swap: curly and straight quotes, the dashes, "…". */
const SAME: Record<string, string> = {
  "‘": "'", "’": "'", "ʼ": "'", "`": "'", "´": "'",
  "“": '"', "”": '"', "„": '"', "«": '"', "»": '"',
  "–": "-", "—": "-", "−": "-", "‑": "-",
  "…": "...",
};

type Folded = {
  text: string;
  /** for each character of `text`: where its own character starts in the original, and where it ends */
  from: number[];
  to: number[];
};

/** The text in one case, with single spaces and one shape per mark, and the way back to the original. */
function fold(s: string): Folded {
  let text = "";
  const from: number[] = [];
  const to: number[] = [];
  let i = 0;
  let gap = false;
  for (const ch of s) {
    const start = i;
    i += ch.length;
    if (/\s/u.test(ch)) {
      gap = true;
      continue;
    }
    if (gap && text) {
      text += " ";
      from.push(start);
      to.push(start);
    }
    gap = false;
    for (const f of SAME[ch] ?? ch.toLowerCase()) {
      text += f;
      for (let k = 0; k < f.length; k++) {
        from.push(start);
        to.push(i);
      }
    }
  }
  return { text, from, to };
}

/** A quote as a model may hand it over: in quotes, with a full stop of its own or "…" at the ends. */
const bare = (quote: string) => quote.trim().replace(/^["'“”‘’«»\s]+|["'“”‘’«»\s]+$/gu, "");
const untrailed = (folded: string) => folded.replace(/^(?:\.\.\.)+\s*|\s*(?:\.\.\.|[.,;:!?])+$/g, "");

/**
 * The quote as it stands in one of the texts, when a text has it word for word: letter case, the
 * shape of quotes and dashes, spacing and a trailing full stop aside. Null when none has it: the
 * words aren't the person's, or they are stitched from two places.
 */
export function findQuote(quote: string, texts: string[]): string | null {
  const whole = fold(bare(quote)).text;
  const needles = [...new Set([whole, untrailed(whole)])].filter((n) => n.replace(/[^\p{L}\p{N}]/gu, "").length >= 2);
  const wordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  for (const needle of needles) {
    for (const t of texts) {
      const f = fold(t);
      // whole words: "he team" isn't a piece of "the team"
      for (let at = f.text.indexOf(needle); at >= 0; at = f.text.indexOf(needle, at + 1)) {
        const end = at + needle.length;
        if (wordChar(needle[0]) && wordChar(f.text[at - 1])) continue;
        if (wordChar(needle[needle.length - 1]) && wordChar(f.text[end])) continue;
        return t.slice(f.from[at], f.to[end - 1]);
      }
    }
  }
  return null;
}

/* ── no new facts ─────────────────────────────────────────────────────── */

/** Quantities said without a number: "doubled", "half", "dozens". One key for the words that mean the same. */
const QUANTITY: [RegExp, string][] = [
  [/^(?:half|halve[sd]?|halving)$/, "half"],
  [/^(?:double[sd]?|doubling|twice|twofold)$/, "double"],
  [/^(?:triple[sd]?|tripling|thrice|threefold)$/, "triple"],
  [/^(?:quadruple[sd]?|quadrupling|fourfold)$/, "quadruple"],
  [/^(?:tenfold)$/, "tenfold"],
  [/^(?:quarter|quarters)$/, "quarter"],
  [/^dozens?$/, "dozen"],
  [/^hundreds?$/, "hundred"],
  [/^thousands?$/, "thousand"],
  [/^millions?$/, "million"],
  [/^billions?$/, "billion"],
];
const quantityKey = (word: string) => QUANTITY.find(([re]) => re.test(word))?.[1] ?? null;

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’&+#./-]*/gu;
/** A word without what hangs on its end: "Brightline’s" → "brightline", "team." → "team". */
const stem = (w: string) => w.toLowerCase().replace(/['’]s$/u, "").replace(/[.'’&/+-]+$/u, "");
const parts = (w: string) => stem(w).split(/[&+#./-]+/u).filter(Boolean);

const numberKeys = (text: string) => numbersIn(spokenNumbers(text)).map((n) => ({ key: numberKey(n.text), text: n.text }));
/** "About one", "an hour", "a week": people say 1 without a digit, and spokenNumbers() only reads "one" next to a unit. */
const SAYS_ONE = /(?<![\p{L}\p{N}])(?:one|a single|an?\s+(?:hour|day|week|month|year|minute|second|person|team|quarter))(?![\p{L}\p{N}])/iu;
/** Two words are the same word in another form when they start alike: "analysis" and "analysed". */
const SAME_START = 5;

/** Does this word start a sentence? There its capital says nothing. */
function startsSentence(text: string, index: number): boolean {
  const before = text.slice(0, index);
  if (/\n\s*$/.test(before)) return true;
  const said = before.replace(/[\s"'“”‘’«»([]+$/u, "");
  return said === "" || /[.!?:;…]$/.test(said);
}

/**
 * What `text` says that none of the `sources` says: numbers ("40%", also said in words), quantities
 * ("doubled"), tools and skills as Job Fit names them, and names (a word with a capital inside a
 * sentence). Each as it is written in the text, once. Empty: the text adds no fact we can see.
 */
export function inventedFacts(text: string, sources: string[]): string[] {
  const src = sources.join("\n").normalize("NFKC");
  const t = text.normalize("NFKC");
  const out: string[] = [];
  const add = (fact: string) => void (out.includes(fact) || out.push(fact));

  const known = new Set(numberKeys(src).map((n) => n.key));
  if (SAYS_ONE.test(src)) known.add("1");
  for (const n of numberKeys(t)) if (!known.has(n.key)) add(n.text);

  const srcWords = new Set<string>();
  const srcStarts = new Set<string>();
  const srcQuantities = new Set<string>();
  for (const m of src.matchAll(WORD)) {
    const s = stem(m[0]);
    for (const w of [s, s.replace(/s$/, ""), ...parts(m[0])]) {
      srcWords.add(w);
      srcStarts.add(w.slice(0, SAME_START));
    }
    const q = quantityKey(s);
    if (q) srcQuantities.add(q);
  }

  // Job Fit's list also holds everyday words ("training", "go", "excel"). A skill counts as a named
  // thing when it is written like one: with a capital, a digit or a sign ("Python", "Node.js", "A/B
  // testing"). A phrase in small letters ("data analysis") is new only when its words are new.
  const srcSkills = new Set(findSkills(src).map((h) => h.key));
  const judged: [number, number][] = [];
  for (const h of findSkills(t)) {
    const written = t.slice(h.start, h.end).trim();
    const named = /[\p{Lu}\p{N}#+./]/u.test(written);
    const words = written.toLowerCase().split(/\s+/);
    if (!named && words.length < 2) continue;
    judged.push([h.start, h.end]);
    if (srcSkills.has(h.key)) continue;
    if (!named && words.every((w) => srcStarts.has(w.slice(0, SAME_START)))) continue;
    add(written);
  }

  for (const m of t.matchAll(WORD)) {
    const at = m.index ?? 0;
    if (judged.some(([a, b]) => at >= a && at < b)) continue;
    const word = m[0].replace(/[.'’&/+-]+$/u, "");
    const s = stem(word);
    const q = quantityKey(s);
    if (q && !srcQuantities.has(q)) add(word);
    // a name: a capital where grammar doesn't ask for one ("SQL" and "PowerBI" say so anywhere)
    if (!/\p{Lu}/u.test(word) || /^I(?:['’](?:m|ve|d|ll))?$/u.test(word)) continue;
    if (startsSentence(t, at) && !/\p{Ll}\p{Lu}|^\p{Lu}{2,}/u.test(word)) continue;
    const there = srcWords.has(s) || srcWords.has(s.replace(/s$/, "")) || parts(word).every((p) => srcWords.has(p));
    if (!there) add(word.replace(/['’]s$/u, ""));
  }
  return out;
}

/* ── what an interviewer doesn't ask ──────────────────────────────────── */

/** In an interviewer's question these are private life, however they are put. */
const PRIVATE_ANYWHERE: RegExp[] = [
  /\bpregnan\w*/i,
  /\b(?:maternity|paternity|parental|sick|medical|bereavement|compassionate)\s+leave\b/i,
  /\bhow old (?:are|were) you\b/i,
  /\b(?:date|year|place|country) of birth\b/i,
  /\breligio\w*/i,
  /\bnationalit\w*/i,
  /\bethnic\w*/i,
  /\bsexual\w*/i,
  /\bgender identity\b/i,
  /\bmarital\b/i,
  /\bcriminal record\b/i,
  /\btrade union\b/i,
];
/** The same when the question makes them the candidate's own: "your health", "your family". */
const PRIVATE_THINGS =
  "age|birthday|health|illness|sickness|disease|diagnosis|condition|disability|therapy|surgery|medication|treatment|recovery|burnout|depression|anxiety|" +
  "family|kids?|child(?:ren)?|baby|son|daughter|husband|wife|spouse|partner|marriage|divorce|" +
  "faith|church|beliefs?|accent|origins?|race|citizenship|visa|immigration status|native language|mother tongue|" +
  "politics|political views|union|leave|absence|time off|gap";
const PRIVATE_ABOUT_YOU: RegExp[] = [
  new RegExp(`\\byour\\s+(?:own\\s+|current\\s+|personal\\s+|career\\s+|employment\\s+)?(?:${PRIVATE_THINGS})\\b`, "i"),
  /\bare you\s+(?:married|single|pregnant|religious|disabled|ill|sick|a citizen|planning (?:a family|to have))\b/i,
  /\b(?:do|did) you\s+have\s+(?:any\s+)?(?:kids|children|a family|a disability|a (?:medical |health )?condition|an illness)\b/i,
  /\b(?:were|are) you\s+(?:ill|sick|unwell|hospitali[sz]ed|pregnant|diagnosed|on (?:\w+\s+)?leave)\b/i,
  /\bwhere (?:are|were) you\s+(?:originally\s+|really\s+)?(?:from|born)\b/i,
  /\bwhen (?:were you born|do you (?:plan|want|intend) to retire)\b/i,
  /\b(?:why|when|how long) were you\s+(?:away|absent|off|out|gone)\b/i,
  /\bwhat (?:happened to you|was wrong with you)\b/i,
];

/** Does an interviewer's question ask about the candidate's private life? (B1: never, even when the answer went there.) */
export function asksAboutPrivateLife(question: string): boolean {
  const q = question.normalize("NFKC").replace(/[‘’ʼ]/g, "'");
  return PRIVATE_ANYWHERE.some((re) => re.test(q)) || PRIVATE_ABOUT_YOU.some((re) => re.test(q));
}

const RUDE: RegExp[] = [
  /\b(?:stupid|idiot\w*|dumb|pathetic|ridiculous|laughable|lazy|incompetent|useless|clueless|embarrassing|nonsense|rubbish|garbage)\b/i,
  /\b(?:terrible|awful|bad|poor|weak) (?:answer|job|work|english)\b/i,
  /\byour (?:bad|poor|broken|weak|terrible|awful) english\b/i,
  /\bwaste of (?:my|our|everyone's) time\b/i,
  /\bare you (?:serious|kidding|joking)\b/i,
  /\b(?:come on|seriously)\s*[,?!]/i,
  /\b(?:can|do|did) you even\b/i,
];

/** Tough insists; it doesn't insult (B1). */
export function isRude(question: string): boolean {
  const q = question.normalize("NFKC").replace(/[‘’ʼ]/g, "'");
  return RUDE.some((re) => re.test(q));
}
