"use client";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { nanoid } from "nanoid";
import { Field, TextArea, SelectField } from "../../components/app/Field";
import {
  ChevronUp,
  ChipClose,
  LanguageIcon,
  PlusThin,
  SkillHardIcon,
  SkillSoftIcon,
  SkillToolIcon,
  TrashOutline,
  UploadRounded,
} from "../../components/figma-icons";
import type {
  CvData,
  EducationItem,
  LanguageItem,
  SectionKey,
  SimpleEntry,
  WorkItem,
} from "../../lib/types";

/** `framed`: the builder shows each step in the Figma form card; the score page's inline "Fix now" doesn't. */
type StepProps = { data: CvData; update: (patch: Partial<CvData>) => void; framed?: boolean };

/** Figma "Frame 274": the #f8f8f8 form card. `tabbed` squares the corner the entry tabs sit on. */
function Panel({
  framed,
  tabbed,
  id,
  labelledBy,
  children,
}: {
  framed?: boolean;
  tabbed?: boolean;
  id?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  const tabpanel = tabbed ? { role: "tabpanel", "aria-labelledby": labelledBy } : {};
  if (!framed)
    return (
      <div className="step-bare" id={id} {...tabpanel}>
        {children}
      </div>
    );
  return (
    <div className={`builder__panel${tabbed ? " is-tabbed" : ""}`} data-figma="form-card" id={id} {...tabpanel}>
      {children}
    </div>
  );
}

/** "Investment Analyst · 2022 – 2025": the non-empty parts, for an entry card's second line. */
const line = (...parts: (string | undefined)[]) => parts.filter((x) => x && x.trim()).join(" · ");
const span = (from?: string, to?: string) => [from, to].filter((x) => x && x.trim()).join(" – ");

/** Nothing typed or ticked yet (ids aside). */
const isBlankEntry = (item: object) =>
  Object.entries(item).every(([k, v]) => k === "id" || v === "" || v === false || v == null);

/**
 * Repeatable entries. Figma always shows a form — never an empty state — so with no entries yet a
 * blank draft is on screen and the first keystroke turns it into a real entry (same id, so the
 * input keeps focus).
 */
function useEntries<T extends { id: string }>(items: T[], blank: () => Omit<T, "id">, write: (next: T[]) => void) {
  const [draftId] = useState(nanoid);
  const make = (id: string, patch: Partial<T> = {}) => ({ ...blank(), ...patch, id }) as T;
  const list = items.length ? items : [make(draftId)];
  return {
    list,
    set: (id: string, patch: Partial<T>) =>
      write(
        items.some((it) => it.id === id)
          ? items.map((it) => (it.id === id ? { ...it, ...patch } : it))
          : [...items, make(id, patch)], // the draft becoming real (items is empty then)
      ),
    add: () => write([...(items.length ? items : [make(draftId)]), make(nanoid())]),
    remove: (id: string) => write(items.filter((it) => it.id !== id)),
  };
}

function AddButton({ label, onClick, className = "" }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" className={`entry-add ${className}`} data-figma="entry-add" onClick={onClick}>
      {/* mynaui:plus cropped to its glyph: Figma places a bare 17×17 vector (stroke overflows it) */}
      <PlusThin viewBox="6 6 12 12" overflow="visible" /> {label}
    </button>
  );
}

/**
 * Figma entry tabs (Education "Variant 2"): tabs sit on top of the card, "Add one more …" and
 * "Delete" share the row under the form. `addInLeft` (Awards, Certifications, …) puts the add
 * button under the left column instead, as those frames do.
 */
function Entries<T extends { id: string }>({
  framed,
  list,
  tabLabel,
  cardSub,
  addLabel,
  onAdd,
  onRemove,
  addInLeft = false,
  render,
}: {
  framed?: boolean;
  list: T[];
  tabLabel: (item: T) => string;
  /** phones: the second line of a saved entry's card */
  cardSub?: (item: T) => string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  addInLeft?: boolean;
  render: (item: T, add: ReactNode) => ReactNode;
}) {
  const [active, setActive] = useState(0);
  const idx = Math.min(active, list.length - 1);
  const item = list[idx];
  const many = list.length > 1;
  const uid = useId();
  const panelId = `${uid}-panel`;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusFirstField = () =>
    requestAnimationFrame(() =>
      document.getElementById(panelId)?.querySelector<HTMLElement>("input, textarea, select")?.focus(),
    );
  const add = (
    <AddButton
      label={addLabel}
      className={addInLeft ? "entry-add--left" : ""}
      onClick={() => {
        // An untouched last entry is the one to fill — don't stack blank entries behind it.
        const last = list.length - 1;
        if (isBlankEntry(list[last])) {
          setActive(last);
          focusFirstField();
          return;
        }
        onAdd();
        setActive(list.length);
        focusFirstField();
      }}
    />
  );
  const selectTab = (i: number) => {
    setActive(i);
    tabRefs.current[i]?.focus();
  };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = list.length;
    const next = { ArrowRight: idx + 1, ArrowLeft: idx - 1 + n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    selectTab(next % n);
  };
  const del = many && (
    <button
      type="button"
      className="entry-delete"
      data-figma="entry-delete"
      onClick={() => {
        onRemove(item.id);
        setActive(0);
      }}
    >
      {/* mage:trash cropped to its glyph geometry (Figma: a 17×18 group, stroke overflowing) */}
      <TrashOutline width={17} height={18} viewBox="3.295 2.75 17.41 18.5" preserveAspectRatio="none" overflow="visible" /> Delete
    </button>
  );
  // Phones (Figma mobile 77:15): the other entries are cards above the form, with Delete and
  // "Edit"; the tabs are hidden there (and the cards above 720px).
  const cards = many && (
    <ul className="entry-cards" data-figma="entry-cards">
      {list.map((it, i) => {
        if (i === idx) return null;
        const title = tabLabel(it) || `Entry ${i + 1}`;
        const sub = cardSub?.(it);
        return (
          <li key={it.id} className="entry-card" data-figma={`entry-card-${i}`}>
            <span className="entry-card__txt">
              <b>{title}</b>
              {sub && <span>{sub}</span>}
            </span>
            <button
              type="button"
              className="entry-card__delete"
              data-figma={`entry-card-delete-${i}`}
              aria-label={`Delete ${title}`}
              onClick={() => {
                onRemove(it.id);
                if (i < idx) setActive(idx - 1);
              }}
            >
              <TrashOutline width={21} height={21} />
            </button>
            <button
              type="button"
              className="entry-card__edit"
              data-figma={`entry-card-edit-${i}`}
              aria-label={`Edit ${title}`}
              onClick={() => {
                setActive(i);
                focusFirstField();
              }}
            >
              Edit <ChevronUp width={16} height={16} className="entry-card__chev" />
            </button>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="entries">
      {cards}
      {many && (
        <div className="entry-tabs" role="tablist" data-figma="entry-tabs">
          {list.map((it, i) => {
            const label = tabLabel(it) || `Entry ${i + 1}`;
            return (
              <button
                key={it.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${i}`}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                aria-selected={i === idx}
                aria-controls={panelId}
                tabIndex={i === idx ? 0 : -1}
                className={`entry-tab${i === idx ? " is-active" : ""}`}
                data-figma={`entry-tab-${i}`}
                title={label}
                onClick={() => setActive(i)}
                onKeyDown={onTabKey}
              >
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
      <Panel framed={framed} tabbed={many} id={panelId} labelledBy={`${uid}-tab-${idx}`}>
        {item && render(item, addInLeft ? add : null)}
        {(!addInLeft || del) && (
          <div className="entry-actions">
            {!addInLeft && add}
            {del}
          </div>
        )}
      </Panel>
    </div>
  );
}

/** Figma "Radiobutton": 24px ring + 12px green label; a checkbox in behaviour. */
function Toggle({ label, on, onChange, figma }: { label: string; on: boolean; onChange: (v: boolean) => void; figma?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      className={`radio${on ? " is-on" : ""}`}
      data-figma={figma}
      onClick={() => onChange(!on)}
    >
      <span className="radio__ring" aria-hidden="true" />
      {label}
    </button>
  );
}

function PhotoField({ figma }: { figma?: string }) {
  return (
    <div className="field field--photo">
      <span className="field__label" data-figma={figma && `${figma}-label`}>
        PHOTO (OPTIONAL)
      </span>
      <button type="button" className="field__upload" data-figma={figma}>
        {/* Figma flattened material-symbols:upload-rounded to a bare 16×15 vector: crop to the glyph */}
        <UploadRounded width={16} height={15} viewBox="4 4.425 16 15.575" preserveAspectRatio="none" /> Upload
      </button>
    </div>
  );
}

export function PersonalInfoStep({ data, update, framed }: StepProps) {
  const p = data.personalInfo;
  const set = (patch: Partial<typeof p>) => update({ personalInfo: { ...p, ...patch } });
  return (
    <Panel framed={framed}>
      <div className="form-grid">
        <div className="form-col">
          <Field figma="field-name" label="NAME, SURNAME" value={p.name} placeholder="David Smith" onChange={(v) => set({ name: v })} />
          <Field figma="field-email" label="EMAIL" value={p.email} placeholder="davidsmith@gmail.com" onChange={(v) => set({ email: v })} />
          <Field figma="field-phone" label="PHONE" value={p.phone} placeholder="+1 123 456 7890" onChange={(v) => set({ phone: v })} />
          <div className="field field--photo field--photo-gap">
            <span className="field__label" data-figma="photo-label">PHOTO (OPTIONAL)</span>
            <button type="button" className="field__upload" data-figma="upload">
              {/* Figma flattened material-symbols:upload-rounded to a bare 16×15 vector: crop to the glyph */}
              <UploadRounded width={16} height={15} viewBox="4 4.425 16 15.575" preserveAspectRatio="none" /> Upload
            </button>
          </div>
        </div>
        <div className="form-col">
          <Field figma="field-linkedin" label="LINKEDIN PROFILE" value={p.linkedin} placeholder="https://www.linkedin.com/in/davidsmith" onChange={(v) => set({ linkedin: v })} />
          <Field figma="field-website" label="PERSONAL WEBSITE" value={p.website} placeholder="https://www.davidsmith.com" onChange={(v) => set({ website: v })} />
          <Field figma="field-country" label="COUNTRY" value={p.country} placeholder="Germany" onChange={(v) => set({ country: v })} />
          <Field figma="field-city" label="CITY/STATE" value={p.cityState} placeholder="Berlin" onChange={(v) => set({ cityState: v })} />
        </div>
      </div>
    </Panel>
  );
}

export function SummaryStep({ data, update, framed }: StepProps) {
  const s = data.summary;
  return (
    <Panel framed={framed}>
      <div className="form-grid">
        <Field
          figma="field-position"
          label="WHAT POSITION ARE YOU APPLYING FOR?"
          value={s.position}
          placeholder="Investment Analyst"
          onChange={(v) => update({ summary: { ...s, position: v } })}
        />
        <TextArea
          figma="field-value"
          className="span-2"
          label="YOUR VALUE PROPOSITION"
          height={256}
          value={s.valueProposition}
          placeholder="Investment Analyst with hands-on experience in financial modeling and valuation (DCF, comparables), focused on assessing investment opportunities and supporting data-driven decision-making. Skilled in analyzing financial statements and market trends to identify growth potential and evaluate risk. Able to translate complex data into clear insights that support strategic investment decisions."
          onChange={(v) => update({ summary: { ...s, valueProposition: v } })}
        />
      </div>
    </Panel>
  );
}

const blankWork = (): Omit<WorkItem, "id"> => ({
  role: "", company: "", description: "", startDate: "", endDate: "", current: false, country: "", cityState: "",
});

export function WorkStep({ data, update, framed }: StepProps) {
  const { list, set, add, remove } = useEntries<WorkItem>(data.work, blankWork, (work) => update({ work }));
  return (
    <Entries
      framed={framed}
      list={list}
      tabLabel={(w) => w.company || w.role}
      cardSub={(w) => line(w.company ? w.role : "", w.current ? span(w.startDate, "Present") : span(w.startDate, w.endDate))}
      addLabel="Add one more work experience"
      onAdd={add}
      onRemove={remove}
      render={(w) => (
        <div className="form-grid form-grid--stretch">
          <div className="form-col">
            <Field figma="field-role" label="ROLE" value={w.role} placeholder="Investment Analyst" onChange={(v) => set(w.id, { role: v })} />
            <Field label="COMPANY" value={w.company} placeholder="Allianz Global Investors" onChange={(v) => set(w.id, { company: v })} />
            <TextArea
              figma="field-description"
              label="POSITION DESCRIPTION"
              height={115}
              value={w.description}
              placeholder="Analyzed financial statements and market trends, developed valuation models, and provided investment recommendations based on quantitative and qualitative analysis"
              onChange={(v) => set(w.id, { description: v })}
            />
          </div>
          <div className="form-col form-col--spread">
            <div className="form-col">
              <div className="field-row">
                <Field figma="field-start" label="START DATE" value={w.startDate} placeholder="October 2022" onChange={(v) => set(w.id, { startDate: v })} />
                <Field label="END DATE" value={w.endDate} placeholder="September 2025" onChange={(v) => set(w.id, { endDate: v })} />
              </div>
              <Toggle figma="toggle-current" label="Currently work here" on={w.current} onChange={(on) => set(w.id, { current: on })} />
            </div>
            <div className="form-col">
              <Field figma="field-country" label="COUNTRY" value={w.country} placeholder="Germany" onChange={(v) => set(w.id, { country: v })} />
              <Field label="CITY/STATE" value={w.cityState} placeholder="Berlin" onChange={(v) => set(w.id, { cityState: v })} />
            </div>
          </div>
        </div>
      )}
    />
  );
}

const blankEducation = (): Omit<EducationItem, "id"> => ({
  institution: "", location: "", degree: "", minor: "", startDate: "", endDate: "", grade: "", additional: "",
});

export function EducationStep({ data, update, framed }: StepProps) {
  const { list, set, add, remove } = useEntries<EducationItem>(data.education, blankEducation, (education) => update({ education }));
  return (
    <Entries
      framed={framed}
      list={list}
      tabLabel={(e) => e.institution || e.degree}
      cardSub={(e) => line(e.institution ? e.degree : "", span(e.startDate, e.endDate))}
      addLabel="Add one more education"
      onAdd={add}
      onRemove={remove}
      render={(e) => (
        <div className="form-grid">
          <div className="form-col">
            <Field figma="field-institution" label="INSTITUTION" value={e.institution} placeholder="Technical University of Munich" onChange={(v) => set(e.id, { institution: v })} />
            <Field label="LOCATION" value={e.location} placeholder="Munchen, Germany" onChange={(v) => set(e.id, { location: v })} />
            <Field label="DEGREE OR QUALIFICATION AND MAJOR" value={e.degree} placeholder="Bachelor of Science" onChange={(v) => set(e.id, { degree: v })} />
            <Field figma="field-minor" label="MINOR" value={e.minor} placeholder="Business Administration" onChange={(v) => set(e.id, { minor: v })} />
          </div>
          <div className="form-col">
            <div className="field-row">
              <Field figma="field-start" label="START DATE" value={e.startDate} placeholder="October 2022" onChange={(v) => set(e.id, { startDate: v })} />
              <Field figma="field-end" label="END DATE" value={e.endDate} placeholder="September 2025" onChange={(v) => set(e.id, { endDate: v })} />
            </div>
            <Field label="GRADE IF APPLICABLE (OPTIONAL)" value={e.grade} placeholder="1.3" onChange={(v) => set(e.id, { grade: v })} />
            <TextArea
              figma="field-additional"
              label="ADDITIONAL INFO (OPTIONAL)"
              height={115}
              value={e.additional}
              placeholder="Graduated with honors, final grade 1.3"
              onChange={(v) => set(e.id, { additional: v })}
            />
          </div>
        </div>
      )}
    />
  );
}

type ChipTone = "hard" | "soft" | "tool" | "lang";

const CHIP_ICONS: Record<ChipTone, ReactNode> = {
  hard: <SkillHardIcon />,
  soft: <SkillSoftIcon className="chip__icon--heavy" />,
  tool: <SkillToolIcon />,
  lang: (
    <span className="chip__icon20">
      <LanguageIcon />
    </span>
  ),
};

/** Figma skill chips: 40px tall, 8px radius, a 20px icon, the label and a violet ×. */
function Chips({
  tone,
  items,
  onRemove,
  figma,
}: {
  tone: ChipTone;
  items: { key: string; label: string }[];
  /** called after removal; the group puts focus back in its input */
  onRemove: (key: string) => void;
  figma?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="chips" data-figma={figma}>
      {items.map((it) => (
        <span className={`chip chip--${tone}`} key={it.key}>
          {CHIP_ICONS[tone]}
          <span className="chip__label">{it.label}</span>
          <button type="button" className="chip__remove" onClick={() => onRemove(it.key)} aria-label={`Remove ${it.label}`}>
            {/* iconamoon:close cropped so the × fills 12 of the 16px, as in Figma (stroke: styles.css) */}
            <ChipClose viewBox="4 4 16 16" />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Type + Enter adds a chip; leaving the field adds what was typed too, so nothing is lost. */
function ChipInput({ label, tone, values, onAdd, onRemove, figma }: {
  label: string;
  tone: ChipTone;
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  figma?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const commit = (input: HTMLInputElement) => {
    if (!input.value.trim()) return;
    onAdd(input.value);
    input.value = "";
  };
  return (
    <div className="chip-group">
      <div className="chip-input">
        <label className="field" data-figma={figma}>
          <span className="field__label">{label}</span>
          <input
            ref={inputRef}
            className="field__input"
            placeholder="Add skills"
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              commit(e.currentTarget);
            }}
            onBlur={(e) => commit(e.currentTarget)}
          />
        </label>
        {/* phones (Figma mobile Skills): a "+" in the field, since a phone keyboard has no obvious Enter */}
        <button
          type="button"
          className="chip-input__add"
          data-figma={figma && `${figma}-add`}
          aria-label={`Add to ${label.toLowerCase()}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const input = inputRef.current;
            if (!input) return;
            commit(input);
            input.focus();
          }}
        >
          <PlusThin size={24} />
        </button>
      </div>
      <Chips
        tone={tone}
        figma={figma && `${figma}-chips`}
        items={values.map((v) => ({ key: v, label: v }))}
        onRemove={(v) => {
          onRemove(v);
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];

export function SkillsStep({ data, update, framed }: StepProps) {
  const [lang, setLang] = useState("");
  const [level, setLevel] = useState("");
  const langRef = useRef<HTMLDivElement>(null);
  const addTo = (key: "skills" | "instruments" | "softSkills", value: string) => {
    const v = value.trim();
    if (v && !data[key].includes(v)) update({ [key]: [...data[key], v] } as Partial<CvData>);
  };
  const removeFrom = (key: "skills" | "instruments" | "softSkills", value: string) =>
    update({ [key]: data[key].filter((x) => x !== value) } as Partial<CvData>);
  // Added on Enter, on picking a level, or on leaving the language field — never silently dropped.
  // No level picked = no level (the "B2" in the field is only a placeholder).
  const addLanguage = (name = lang, lvl = level) => {
    const n = name.trim();
    if (!n) return;
    const item: LanguageItem = { id: nanoid(), name: n, level: lvl };
    update({ languages: [...data.languages.filter((l) => l.name.toLowerCase() !== n.toLowerCase()), item] });
    setLang("");
    setLevel("");
  };

  return (
    <Panel framed={framed}>
      <div className="form-grid">
        <div className="form-col">
          <ChipInput figma="skills-hard" label="HARD SKILLS" tone="hard" values={data.skills} onAdd={(v) => addTo("skills", v)} onRemove={(v) => removeFrom("skills", v)} />
          <ChipInput figma="skills-soft" label="SOFT SKILLS" tone="soft" values={data.softSkills} onAdd={(v) => addTo("softSkills", v)} onRemove={(v) => removeFrom("softSkills", v)} />
        </div>
        <div className="form-col">
          <ChipInput figma="skills-tools" label="INSTRUMENTS" tone="tool" values={data.instruments} onAdd={(v) => addTo("instruments", v)} onRemove={(v) => removeFrom("instruments", v)} />
          <div className="chip-group" ref={langRef}>
            <div
              className="field-row"
              onBlur={(e) => {
                // leaving the Language + Level pair (not moving between them) adds what was typed
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) addLanguage();
              }}
            >
              <Field
                figma="skills-language"
                label="LANGUAGE"
                value={lang}
                placeholder="English"
                onChange={setLang}
                onEnter={() => addLanguage()}
              />
              <SelectField
                figma="skills-level"
                label="LEVEL"
                value={level}
                placeholder="B2"
                options={LANGUAGE_LEVELS}
                onChange={(v) => (lang.trim() ? addLanguage(lang, v) : setLevel(v))}
              />
            </div>
            <Chips
              tone="lang"
              figma="skills-language-chips"
              items={data.languages.map((l) => ({ key: l.id, label: `${l.name} ${l.level}`.trim() }))}
              onRemove={(id) => {
                update({ languages: data.languages.filter((l) => l.id !== id) });
                langRef.current?.querySelector("input")?.focus();
              }}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

/** Generic repeatable list of SimpleEntry-based sections. */
function useSimpleEntries(key: SectionKey, data: CvData, update: (patch: Partial<CvData>) => void) {
  return useEntries<SimpleEntry>(
    data[key] as SimpleEntry[],
    () => ({ title: "", description: "", date: "" }),
    (next) => update({ [key]: next } as Partial<CvData>),
  );
}

export function AwardsStep({ data, update, framed }: StepProps) {
  const { list, set, add, remove } = useSimpleEntries("awards", data, update);
  return (
    <Entries
      framed={framed}
      list={list}
      addInLeft
      tabLabel={(it) => it.title}
      cardSub={(it) => line(it.organisation, it.date)}
      addLabel="Add one more award"
      onAdd={add}
      onRemove={remove}
      render={(it, addButton) => (
        <div className="form-grid">
          <div className="form-col">
            <Field figma="field-title" label="AWARD OR SCHOLARSHIP" value={it.title} placeholder="Dean's List" onChange={(v) => set(it.id, { title: v })} />
            <Field label="ORGANISATION" value={it.organisation ?? ""} placeholder="Technical University of Munich" onChange={(v) => set(it.id, { organisation: v })} />
            {addButton}
          </div>
          <div className="form-col">
            <Field figma="field-date" className="field--half" label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => set(it.id, { date: v })} />
            <PhotoField figma="entry-upload" />
          </div>
        </div>
      )}
    />
  );
}

export function CertificationsStep({ data, update, framed }: StepProps) {
  const { list, set, add, remove } = useSimpleEntries("certifications", data, update);
  return (
    <Entries
      framed={framed}
      list={list}
      addInLeft
      tabLabel={(it) => it.title}
      cardSub={(it) => line(it.issuer, it.date)}
      addLabel="Add one more certification"
      onAdd={add}
      onRemove={remove}
      render={(it, addButton) => (
        <div className="form-grid">
          <div className="form-col">
            <Field figma="field-title" label="CERTIFICATION" value={it.title} placeholder="AWS Certified Solutions Architect" onChange={(v) => set(it.id, { title: v })} />
            <Field label="ISSUED INSTITUTION" value={it.issuer ?? ""} placeholder="Amazon Web Services" onChange={(v) => set(it.id, { issuer: v })} />
            {addButton}
          </div>
          <div className="form-col">
            <Field figma="field-date" className="field--half" label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => set(it.id, { date: v })} />
            <PhotoField figma="entry-upload" />
          </div>
        </div>
      )}
    />
  );
}

export function PublicationsStep({ data, update, framed }: StepProps) {
  const { list, set, add, remove } = useSimpleEntries("publications", data, update);
  return (
    <Entries
      framed={framed}
      list={list}
      addInLeft
      tabLabel={(it) => it.title}
      cardSub={(it) => line(it.publisher, it.date)}
      addLabel="Add one more publication"
      onAdd={add}
      onRemove={remove}
      render={(it, addButton) => (
        <div className="form-grid">
          <div className="form-col">
            <Field figma="field-title" label="PUBLICATION" value={it.title} placeholder="Machine Learning in Finance" onChange={(v) => set(it.id, { title: v })} />
            <Field label="PUBLISHER" value={it.publisher ?? ""} placeholder="IEEE" onChange={(v) => set(it.id, { publisher: v })} />
            <Field figma="field-link" label="LINK" value={it.link ?? ""} placeholder="https://doi.org/…" onChange={(v) => set(it.id, { link: v })} />
            {addButton}
          </div>
          <div className="form-col">
            <Field figma="field-date" className="field--half" label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => set(it.id, { date: v })} />
            <PhotoField figma="entry-upload" />
          </div>
        </div>
      )}
    />
  );
}

const ACTIVITY_TYPES = ["Competition", "Research", "Hackathon", "Club / Society", "Project", "Mentorship", "Other"];

export function ActivitiesStep({ data, update, framed }: StepProps) {
  const { list, set, add, remove } = useSimpleEntries("activities", data, update);
  return (
    <Entries
      framed={framed}
      list={list}
      addInLeft
      tabLabel={(it) => it.title || it.activityType || ""}
      cardSub={(it) => line(it.role, it.ongoing ? span(it.date, "Present") : span(it.date, it.endDate))}
      addLabel="Add one more activity"
      onAdd={add}
      onRemove={remove}
      render={(it, addButton) => (
        <div className="form-grid">
          <div className="form-col">
            <SelectField
              figma="field-type"
              label="ACTIVITY TYPE"
              value={it.activityType ?? ""}
              placeholder="Select type"
              options={ACTIVITY_TYPES}
              onChange={(v) => set(it.id, { activityType: v })}
            />
            <Field label="ROLE/CONTRIBUTION" value={it.role ?? ""} placeholder="Equity Research Analyst" onChange={(v) => set(it.id, { role: v })} />
            <TextArea
              figma="field-description"
              label="DESCRIPTION"
              height={102}
              value={it.description}
              placeholder="Conducted financial analysis of a publicly traded company, built a DCF model, and prepared an investment recommendation presented to a panel of judges"
              onChange={(v) => set(it.id, { description: v })}
            />
            {/* Figma leaves the add button low in this card (76px under the description) */}
            <div className="entry-add-low">{addButton}</div>
          </div>
          <div className="form-col">
            <Field figma="field-organization" label="ORGANIZATION" value={it.title} placeholder="CFA Institute Research Challenge" onChange={(v) => set(it.id, { title: v })} />
            <Field label="LOCATION" value={it.location ?? ""} placeholder="Munich, Germany" onChange={(v) => set(it.id, { location: v })} />
            <div className="field-row">
              <Field figma="field-start" label="START DATE" value={it.date} placeholder="2. October 2022" onChange={(v) => set(it.id, { date: v })} />
              <Field label="END DATE" value={it.endDate ?? ""} placeholder="-" onChange={(v) => set(it.id, { endDate: v })} />
            </div>
            <Toggle figma="toggle-ongoing" label="Ongoing" on={!!it.ongoing} onChange={(on) => set(it.id, { ongoing: on })} />
          </div>
        </div>
      )}
    />
  );
}

/** Not in Figma: built like "Relevant activities" (the closest designed section). */
export function VolunteeringStep({ data, update, framed }: StepProps) {
  const { list, set, add, remove } = useSimpleEntries("volunteering", data, update);
  return (
    <Entries
      framed={framed}
      list={list}
      addInLeft
      tabLabel={(it) => it.title}
      cardSub={(it) => line(it.role, span(it.date, it.endDate))}
      addLabel="Add one more volunteering entry"
      onAdd={add}
      onRemove={remove}
      render={(it, addButton) => (
        <div className="form-grid">
          <div className="form-col">
            <Field label="ORGANIZATION" value={it.title} placeholder="Red Cross" onChange={(v) => set(it.id, { title: v })} />
            <Field label="ROLE" value={it.role ?? ""} placeholder="Volunteer Coordinator" onChange={(v) => set(it.id, { role: v })} />
            <TextArea
              label="DESCRIPTION"
              height={102}
              value={it.description}
              placeholder="Coordinated a team of 12 volunteers for community outreach…"
              onChange={(v) => set(it.id, { description: v })}
            />
            {addButton}
          </div>
          <div className="form-col">
            <Field label="LOCATION" value={it.location ?? ""} placeholder="Berlin, Germany" onChange={(v) => set(it.id, { location: v })} />
            <div className="field-row">
              <Field label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => set(it.id, { date: v })} />
              <Field label="END DATE" value={it.endDate ?? ""} placeholder="-" onChange={(v) => set(it.id, { endDate: v })} />
            </div>
            <Toggle label="Ongoing" on={!!it.ongoing} onChange={(on) => set(it.id, { ongoing: on })} />
          </div>
        </div>
      )}
    />
  );
}
