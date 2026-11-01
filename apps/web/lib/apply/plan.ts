/**
 * From an application form (its controls, read by `controlsOf`) and the person's profile, the plan:
 * what the agent types, what it picks, where the CV goes, and what only the person answers.
 *
 * The rules (APLICARE-CU-AGENT.md §5):
 * - the agent fills only contact details and the current job, from the CV the person chose;
 * - sensitive questions (right to work, visa, salary, gender, ethnicity, disability, health,
 *   criminal record, age, consent to terms) go to the person, always, and are never stored;
 * - anything the agent doesn't recognise goes to the person too: nothing is guessed;
 * - the posting's text is never read for instructions: only the controls' labels are used.
 */
import type { FormControl } from "./snapshot";
import type { ApplyProfile } from "./profile";

export type ProfileField = keyof ApplyProfile;

export interface FillStep {
  ref: string;
  label: string;
  field: ProfileField;
  value: string;
}

export interface ChooseStep {
  ref: string;
  label: string;
  option: string;
}

export interface PersonItem {
  /** stable within one plan: the person's answers are keyed by it */
  id: string;
  kind: "text" | "choice" | "radio" | "checkbox";
  label: string;
  required: boolean;
  /** asked of the person every time and never stored (APPLY-COPILOT-DESIGN.md AG-7) */
  sensitive: boolean;
  /** text, choice and checkbox: one ref; radio: one per option, in the order of `options` */
  refs: string[];
  options: string[];
}

export interface ApplyPlan {
  fill: FillStep[];
  choose: ChooseStep[];
  /** the form asks for a CV file; the engine finds the file input itself */
  resume: { label: string } | null;
  person: PersonItem[];
  submit: { ref: string; label: string } | null;
}

export interface PlanOptions {
  /** what "How did you hear about this job?" may be answered with, if the form offers it */
  sourceAnswers?: string[];
}

const SENSITIVE = new RegExp(
  [
    // English
    "authori[sz]", "legally (able|entitled|permitted)", "right to work", "work permit", "eligib", "sponsor", "visa",
    "salary", "compensation", "pay expectation", "desired pay", "remuneration", "\\bwage",
    "gender", "\\bsex\\b", "pronoun", "\\brace\\b", "ethnic", "hispanic", "latin[oax]", "disabilit", "health", "medical",
    "veteran", "military", "criminal", "convict", "felony", "\\bage\\b", "date of birth", "birth ?date", "religio",
    "sexual orientation", "citizenship", "nationality", "marital", "pregnan", "trade union",
    "consent", "\\bagree", "privacy", "terms", "acknowledg", "certify", "i confirm", "declar",
    // Romanian
    "salariu", "drept(ul)? de munc", "permis de munc", "viz[ăa]", "etnie", "dizabilit", "s[ăa]n[ăa]tate", "cazier",
    "v[âa]rst", "data na[șsş]terii", "cet[ăa][țtţ]enie", "religie", "consim[țtţ]", "sunt de acord",
    // Russian
    "зарплат", "оклад", "виз[аы]", "разрешени[ея] на работу", "\\bпол\\b", "национальн", "инвалид", "здоров", "судим",
    "возраст", "дата рождения", "гражданств", "религи", "согласи",
  ].join("|"),
  "iu",
);

const FIELDS: [ProfileField, RegExp][] = [
  ["firstName", /\b(first|given)\s*name\b|^prenume|^имя$/iu],
  ["lastName", /\b(last|family)\s*name\b|\bsurname\b|^nume de familie|^фамилия/iu],
  ["fullName", /^(full\s*|your\s*)?name$|^nume(le)?( complet)?$|^ф\.?\s?и\.?\s?о\.?$|^имя и фамилия$/iu],
  ["email", /e-?mail|^почта|электронн/iu],
  ["phone", /phone|mobile|\btel\b|telefon|телефон/iu],
  ["linkedin", /linkedin/iu],
  ["website", /website|portfolio|personal (site|url|page)|site web|^сайт/iu],
  ["city", /^city\b|^town\b|^ora[șsş]|^localitate|^город/iu],
  ["location", /^(current\s+)?location\b|^where are you (based|located)|^loca[țtţ]ie|^местоположение/iu],
  ["country", /^country\b|^[țtţ]ara\b|^страна/iu],
  ["currentCompany", /current (company|employer)|^(company|employer)$|compania (actual|curent)|текущ(ая|ий) (компания|работодатель)/iu],
  ["currentTitle", /current (job )?(title|role|position)|^job title$|func[țtţ]ia (actual|curent)|^должность/iu],
];

const RESUME = /resume|\bcv\b|curriculum|r[ée]sum[ée]|резюме/iu;
const COVER = /cover|letter|scrisoare|сопроводит/iu;
const SUBMIT = /^(submit|apply|send)( my| your)?( application| now)?$|^submit application$|^trimite|^aplic[ăa]|^отправить|^откликнуться/iu;
const SOURCE = /hear about|how did you (find|learn)|source|de unde ai aflat|откуда вы узнали/iu;
const DEFAULT_SOURCES = ["job board", "online job board", "job site", "internet job board"];

/** "First Name *" → "First Name"; the required mark is in the control's attributes too. */
export function cleanLabel(s: string): string {
  return s
    .replace(/\s*(\*|✱|✳|\(required\)|\(obligatoriu\)|\(обязательно\))\s*/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const labelOf = (c: FormControl) => cleanLabel(c.name || c.context || "");
const sameOption = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function planApplication(controls: FormControl[], profile: ApplyProfile, opts: PlanOptions = {}): ApplyPlan {
  const plan: ApplyPlan = { fill: [], choose: [], resume: null, person: [], submit: null };
  const sources = opts.sourceAnswers ?? DEFAULT_SOURCES;
  let n = 0;
  const ask = (item: Omit<PersonItem, "id">) => plan.person.push({ id: `q${++n}`, ...item });
  const radios = new Map<string, PersonItem>();

  for (const c of controls) {
    const label = labelOf(c);
    const sensitive = SENSITIVE.test(label) || (c.group !== null && SENSITIVE.test(c.group));

    if (c.role === "button") {
      const said = `${c.name} ${c.context ?? ""}`;
      if (SUBMIT.test(cleanLabel(c.name))) plan.submit = { ref: c.ref, label: cleanLabel(c.name) };
      else if (!plan.resume && RESUME.test(said) && !COVER.test(said)) plan.resume = { label: cleanLabel(c.context && RESUME.test(c.context) ? c.context : c.name) };
      continue;
    }

    if (c.role === "radio") {
      const question = cleanLabel(c.group ?? c.context ?? "");
      const key = question || `radio-${c.ref}`;
      let item = radios.get(key);
      if (!item) {
        ask({ kind: "radio", label: question, required: c.required, sensitive: SENSITIVE.test(question), refs: [], options: [] });
        item = plan.person[plan.person.length - 1];
        radios.set(key, item);
      }
      item.refs.push(c.ref);
      item.options.push(cleanLabel(c.name));
      item.required ||= c.required;
      continue;
    }

    if (c.role === "checkbox" || c.role === "switch") {
      ask({ kind: "checkbox", label, required: c.required, sensitive, refs: [c.ref], options: [] });
      continue;
    }

    if (c.role === "combobox" || c.role === "listbox") {
      const options = c.options.map((o) => o.name).filter((o) => o && !/^(select|choose|please select|alege|выберите)/iu.test(o.replace(/…|\.\.\./g, "")));
      if (!sensitive) {
        if (SOURCE.test(label)) {
          const pick = sources.map((s) => options.find((o) => sameOption(o, s))).find(Boolean);
          if (pick) {
            plan.choose.push({ ref: c.ref, label, option: pick });
            continue;
          }
        }
        const field = FIELDS.find(([, re]) => re.test(label))?.[0];
        const want = field ? profile[field] : "";
        const pick = want ? options.find((o) => sameOption(o, want)) : undefined;
        if (pick) {
          plan.choose.push({ ref: c.ref, label, option: pick });
          continue;
        }
      }
      ask({ kind: "choice", label, required: c.required, sensitive, refs: [c.ref], options });
      continue;
    }

    // textbox, searchbox, spinbutton
    if (!sensitive) {
      const field = FIELDS.find(([, re]) => re.test(label))?.[0];
      if (field && profile[field]) {
        plan.fill.push({ ref: c.ref, label, field, value: profile[field] });
        continue;
      }
    }
    ask({ kind: "text", label, required: c.required, sensitive, refs: [c.ref], options: [] });
  }

  // Romanian forms: "Nume" next to "Prenume" is the family name, not the full name.
  if (plan.fill.some((f) => f.field === "firstName"))
    for (const f of plan.fill)
      if (f.field === "fullName" && /^nume/iu.test(f.label)) Object.assign(f, { field: "lastName", value: profile.lastName });

  return plan;
}

/** The person's answers, keyed by `PersonItem.id`: text for text and choice, the option for radio, true/false for checkbox. */
export type Answers = Record<string, string | boolean>;

/**
 * What still blocks a submission: a sensitive question the person hasn't gone through (answered, or
 * left empty on purpose with ""), a required item without an answer, an answer that doesn't fit.
 */
export function missingAnswers(plan: ApplyPlan, answers: Answers): PersonItem[] {
  return plan.person.filter((item) => {
    const a = answers[item.id];
    if (a === undefined) return item.required || item.sensitive;
    if (a === "") return item.required;
    if (item.kind === "checkbox") return typeof a !== "boolean" || (item.required && a !== true);
    if (typeof a !== "string") return true;
    if (item.kind === "radio" || (item.kind === "choice" && item.options.length)) return !item.options.some((o) => sameOption(o, a));
    return false;
  });
}
