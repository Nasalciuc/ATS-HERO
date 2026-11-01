/**
 * From an application form (its controls, read by `controlsOf`) and the person's profile, the plan:
 * what the agent types, what it picks, where the CV goes, and what only the person answers.
 *
 * The rules (APLICARE-CU-AGENT.md §5):
 * - the agent fills only contact details and the current job, from the CV the person chose, and only
 *   into a field whose own name says what it is (a name that is the whole label: "Country", never
 *   "Country of birth");
 * - sensitive questions (right to work, visa, salary, gender, ethnicity, disability, health, criminal
 *   record, age, birth, consent to terms) go to the person, always, and are never stored;
 * - everything else the form asks goes to the person too, and nothing is sent until the person has
 *   gone through every item: answered it, or said to leave it empty;
 * - a field without a name of its own, or a question the agent can't find, is treated as sensitive;
 * - the posting's text is never read for instructions: only the controls' own labels are used.
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
  /**
   * manual: a control the engine can't set reliably (a date, a slider, a custom picker, radios
   * without a question); its form goes back to the person, who fills it in on their own
   */
  kind: "text" | "choice" | "radio" | "checkbox" | "manual";
  label: string;
  required: boolean;
  /** asked of the person every time and never stored (APPLY-COPILOT-DESIGN.md AG-7) */
  sensitive: boolean;
  /** text, choice, checkbox and manual: one ref; radio: one per option, in the order of `options` */
  refs: string[];
  options: string[];
  /** what the form holds now: the text, the chosen option, the checked radio, the box's state; null when empty */
  current: string | boolean | null;
  /** a choice's "nothing chosen" option ("Select…"), if it has one: answering "" puts it back */
  placeholder: string | null;
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
  /**
   * What "How did you hear about this job?" may be answered with, if the form offers it. None by
   * default: the person answers it, like every other question.
   */
  sourceAnswers?: string[];
}

// A whole word in any script (\b knows only Latin letters).
const word = (s: string) => `(?<![\\p{L}\\p{N}_])(?:${s})(?![\\p{L}\\p{N}_])`;

const SENSITIVE = new RegExp(
  [
    // English
    "authori[sz]", "legally (able|entitled|permitted)", "right to work", "work permit", "eligib", "sponsor", word("visas?"),
    "citizen", "immigra", "green card", "residen(ce|t) (permit|status|card)",
    "salar", "compensation", "pay expectation", "expected (pay|rate)", "desired (pay|rate)", "remuneration", word("wages?"),
    word("ctc"), "hourly rate", "day rate",
    "gender", word("sex"), "pronoun", word("race"), "ethnic", "hispanic", "latin[oax]", word("origin"), "nationality",
    "birth", word("born"), word("dob"), word("age"), "how old", "(over|at least|older than) (the age of )?1[68]", "18 (years|or older)",
    "disabilit", "handicap", "health", "medical", "vaccin", "pregnan",
    "veteran", "military", "criminal", "convict", "felony", "arrest", "background check",
    "religio", "orientation", "marital", "family status", "trade union", "union member",
    "consent", word("agree"), "privacy", "terms", "acknowledg", "certify", "i confirm", "declar", "accept",
    // Romanian
    "salari", "preten[țtţ]ii", "remunera", "drept(ul)? de munc", "permis(ul)? de munc", word("viz[ăa]"), "cet[ăa][țtţ]en",
    "na[țtţ]ionalitat", "etni", word("gen(ul)?"), word("sex(ul)?"), "orientare", "dizabilit", "s[ăa]n[ăa]tate", "cazier",
    "antecedente", "penal", "v[âa]rst", "na[șsş]ter", "religi", "stare(a)? civil", "sindicat", "consim[țtţ]", "sunt de acord",
    "termen", "condi[țtţ]ii", "confiden[țtţ]ialit",
    // Russian
    "зарплат", "заработн", "оклад", "доход", "вознагражд", word("виз[аыу]?"), "разрешени[ея] на работу", "гражданств",
    "иммигра", word("пол"), "гендер", "национальн", "этни", "происхожд", "рожден", "возраст", "инвалид", "здоров",
    "медицин", "беремен", "судим", "уголовн", "религи", "ориентац", "семейн", "согласи", "принимаю", "услови",
    "конфиденциальн", "персональн",
  ].join("|"),
  "iu",
);

export const isSensitive = (label: string) => SENSITIVE.test(label);

// Each pattern is a whole label (after `bare`): "Country" is filled, "Country of birth" is not.
const FIELDS: [ProfileField, RegExp][] = [
  ["firstName", /^((first|given)[\s-]*name|prenume(le)?|имя)$/iu],
  ["lastName", /^((last|family)[\s-]*name|surname|nume(le)? de familie|фамилия)$/iu],
  ["fullName", /^((full|your)[\s-]*)?name$|^nume(le)?( complet)?$|^(ф\.?\s?и\.?\s?о\.?|имя и фамилия)$/iu],
  ["email", /^((your|e-?mail)\s+)?(e-?mail|email address|e-?mail address)$|^(adres[aă] de )?e-?mail$|^(электронная почта|почта)$/iu],
  ["phone", /^((your|mobile|cell)\s+)?(phone|mobile|telephone|cell)( number| phone)?$|^(num[aă]r(ul)? de )?telefon$|^(номер )?телефона?$/iu],
  ["linkedin", /^linkedin( profile)?( url)?$/iu],
  ["website", /^(website|portfolio|personal (website|site|url|page)|(portfolio|website) url|site web|сайт|портфолио)$/iu],
  ["city", /^(city|town|ora[șsş](ul)?|localitate(a)?|город)$/iu],
  ["location", /^((current\s+)?location|where are you (based|located)|loca[țtţ]ie|местоположение)$/iu],
  ["country", /^(country( of residence)?|[țtţ]ara( de reziden[țtţ][ăa])?|страна( проживания)?)$/iu],
  ["currentCompany", /^(current (company|employer)|company|employer|compania (actual[ăa]|curent[ăa])|angajator(ul)? actual|текущ(ая|ий) (компания|работодатель))$/iu],
  ["currentTitle", /^(current (job )?(title|role|position)|job title|func[țtţ]ia (actual[ăa]|curent[ăa])|должность)$/iu],
];

const RESUME = /resume|\bcv\b|curriculum|r[ée]sum[ée]|резюме/iu;
const COVER = /cover|letter|scrisoare|сопроводит/iu;
const SUBMIT = /^(submit|apply|send)( my| your)?( application| now)?$|^submit application$|^trimite|^aplic[ăa]|^отправить|^откликнуться/iu;
const SOURCE = /hear about|how did you (find|learn)|source|de unde ai aflat|откуда вы узнали/iu;
const PLACEHOLDER = /^(-+|—|select|choose|please (select|choose)|alege|selecteaz|выберите)/iu;
const TEXT_ROLES = new Set(["textbox", "searchbox", "spinbutton"]);

/** "First Name *" → "First Name"; the required mark is in the control's attributes too. */
export function cleanLabel(s: string): string {
  return s
    .replace(/\s*(\*|✱|✳|\(required\)|\(obligatoriu\)|\(обязательно\))\s*/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A label as the field patterns read it: no trailing ":" or "?". */
const bare = (label: string) => label.replace(/[\s:?]+$/u, "");
const fieldOf = (label: string) => FIELDS.find(([, re]) => re.test(bare(label)))?.[0];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const isPlaceholder = (o: string) => !o.trim() || PLACEHOLDER.test(o.trim());

export function planApplication(controls: FormControl[], profile: ApplyProfile, opts: PlanOptions = {}): ApplyPlan {
  const plan: ApplyPlan = { fill: [], choose: [], resume: null, person: [], submit: null };
  const sources = opts.sourceAnswers ?? [];
  let n = 0;
  const ask = (item: Omit<PersonItem, "id">) => {
    const it = { id: `q${++n}`, ...item };
    plan.person.push(it);
    return it;
  };
  const radios = new Map<number, PersonItem>();

  for (const c of controls) {
    // its own name, from the page's markup; the text before it only labels it for the person
    const named = cleanLabel(c.name);
    const label = named || cleanLabel(c.context ?? "");
    const question = cleanLabel(c.group ?? "");
    const sensitive = !label || isSensitive(label) || (question !== "" && isSensitive(question));
    const base = { required: c.required, refs: [c.ref], options: [] as string[], current: null, placeholder: null };

    if (c.role === "button") {
      const said = `${c.name} ${c.context ?? ""}`;
      if (SUBMIT.test(named)) plan.submit = { ref: c.ref, label: named };
      else if (!plan.resume && RESUME.test(said) && !COVER.test(said)) plan.resume = { label: cleanLabel(c.context && RESUME.test(c.context) ? c.context : c.name) };
      continue;
    }

    if (c.role === "radio") {
      // radios answer one question together; without a question nobody can tell what "Yes" means
      if (!question || c.groupId === null) {
        ask({ ...base, kind: "manual", label: named, sensitive: true, current: c.checked ? named : null });
        continue;
      }
      let item = radios.get(c.groupId);
      if (!item) {
        item = ask({ ...base, kind: "radio", label: question, sensitive: isSensitive(question), refs: [] });
        radios.set(c.groupId, item);
      }
      item.refs.push(c.ref);
      item.options.push(named);
      item.required ||= c.required;
      if (c.checked) item.current = named;
      continue;
    }

    if (c.role === "checkbox" || c.role === "switch") {
      // a box named "Yes" is read with its question
      const own = question && !same(question, named) ? (named ? `${question}: ${named}` : question) : label;
      ask({ ...base, kind: "checkbox", label: own, sensitive: !own || isSensitive(own), current: c.checked === true });
      continue;
    }

    if (c.role === "combobox" || c.role === "listbox") {
      // a <select> lists its options; a combobox without them is a custom picker (an autocomplete)
      if (!c.options.length) {
        ask({ ...base, kind: "manual", label, sensitive, current: c.value });
        continue;
      }
      const placeholder = c.options.find((o) => isPlaceholder(o.name))?.name ?? null;
      const options = c.options.map((o) => o.name).filter((o) => !isPlaceholder(o));
      if (named && !sensitive) {
        const field = fieldOf(named);
        const wanted = SOURCE.test(named) ? sources : field ? [profile[field]] : [];
        const pick = wanted.map((w) => (w ? options.find((o) => same(o, w)) : undefined)).find(Boolean);
        if (pick) {
          plan.choose.push({ ref: c.ref, label: named, option: pick });
          continue;
        }
      }
      const current = c.value && !isPlaceholder(c.value) ? c.value : null;
      ask({ ...base, kind: "choice", label, sensitive, options, current, placeholder });
      continue;
    }

    if (TEXT_ROLES.has(c.role)) {
      const field = named && !sensitive ? fieldOf(named) : undefined;
      if (field && profile[field]) {
        plan.fill.push({ ref: c.ref, label: named, field, value: profile[field] });
        continue;
      }
      ask({ ...base, kind: "text", label, sensitive, current: c.value });
      continue;
    }

    // a date, a slider, anything else
    ask({ ...base, kind: "manual", label, sensitive, current: c.value });
  }

  // Romanian forms: "Nume" next to "Prenume" is the family name, not the full name.
  if (plan.fill.some((f) => f.field === "firstName"))
    for (const f of plan.fill)
      if (f.field === "fullName" && /^nume/iu.test(f.label)) Object.assign(f, { field: "lastName", value: profile.lastName });

  return plan;
}

/**
 * The person's answers, keyed by `PersonItem.id`: text for text and choice, the option for radio,
 * true/false for checkbox. "" leaves a text, choice or radio empty, on purpose.
 */
export type Answers = Record<string, string | boolean>;

function fits(item: PersonItem, a: string | boolean | undefined): boolean {
  if (a === undefined) return false; // every item is gone through, explicitly
  switch (item.kind) {
    case "manual":
      return false;
    case "checkbox":
      return typeof a === "boolean" && (a || !item.required);
    case "text":
      return typeof a === "string" && (a.trim() !== "" || !item.required);
    case "choice":
      if (typeof a !== "string") return false;
      // a choice without a "Select…" option can't be put back to nothing: the person picks one
      if (a === "") return !item.required && item.placeholder !== null;
      return item.options.some((o) => same(o, a));
    case "radio":
      if (typeof a !== "string") return false;
      // a checked radio can't be unchecked
      if (a === "") return !item.required && item.current === null;
      return item.options.some((o) => same(o, a));
  }
}

/** What still blocks a submission: an item the person hasn't gone through, or an answer the form can't take. */
export function missingAnswers(plan: ApplyPlan, answers: Answers): PersonItem[] {
  return plan.person.filter((item) => !fits(item, answers[item.id]));
}

/** An item's identity across two readings of the same form (its refs and id can change). */
export const itemKey = (item: PersonItem) => [item.kind, item.label, ...item.options].join("\u0001");
