import { nanoid } from "nanoid";
import { Field, TextArea } from "../../components/app/Field";
import { Check, Plus } from "../../components/icons";
import type {
  CvData,
  EducationItem,
  SectionKey,
  SimpleEntry,
  WorkItem,
} from "../../lib/types";

type StepProps = { data: CvData; update: (patch: Partial<CvData>) => void };

export function PersonalInfoStep({ data, update }: StepProps) {
  const p = data.personalInfo;
  const set = (patch: Partial<typeof p>) =>
    update({ personalInfo: { ...p, ...patch } });
  return (
    <div className="form-grid">
      <div className="form-col">
        <Field label="NAME, SURNAME" value={p.name} placeholder="David Smith" onChange={(v) => set({ name: v })} />
        <Field label="EMAIL" value={p.email} placeholder="davidsmith@gmail.com" onChange={(v) => set({ email: v })} />
        <Field label="PHONE" value={p.phone} placeholder="+1 123 456 7890" onChange={(v) => set({ phone: v })} />
        <div className="field">
          <span className="field__label">PHOTO (OPTIONAL)</span>
          <button className="field__upload">⬆ Upload</button>
        </div>
      </div>
      <div className="form-col">
        <Field label="LINKEDIN PROFILE" value={p.linkedin} placeholder="https://www.linkedin.com/in/davidsmith" onChange={(v) => set({ linkedin: v })} />
        <Field label="PERSONAL WEBSITE" value={p.website} placeholder="https://www.davidsmith.com" onChange={(v) => set({ website: v })} />
        <Field label="COUNTRY" value={p.country} placeholder="Germany" onChange={(v) => set({ country: v })} />
        <Field label="CITY/STATE" value={p.cityState} placeholder="Berlin" onChange={(v) => set({ cityState: v })} />
      </div>
    </div>
  );
}

export function SummaryStep({ data, update }: StepProps) {
  const s = data.summary;
  return (
    <div className="form-single">
      <Field
        label="WHAT POSITION ARE YOU APPLYING FOR?"
        value={s.position}
        placeholder="Investment Analyst"
        onChange={(v) => update({ summary: { ...s, position: v } })}
      />
      <TextArea
        label="YOUR VALUE PROPOSITION"
        rows={8}
        value={s.valueProposition}
        placeholder="Investment Analyst with hands-on experience in financial modeling and valuation…"
        onChange={(v) => update({ summary: { ...s, valueProposition: v } })}
      />
    </div>
  );
}

export function WorkStep({ data, update }: StepProps) {
  const items = data.work;
  const setItem = (id: string, patch: Partial<WorkItem>) =>
    update({ work: items.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const add = () =>
    update({
      work: [
        ...items,
        { id: nanoid(), role: "", company: "", description: "", startDate: "", endDate: "", current: false, country: "", cityState: "" },
      ],
    });
  const remove = (id: string) => update({ work: items.filter((w) => w.id !== id) });

  if (items.length === 0) {
    return <EmptyState label="work experience" onAdd={add} />;
  }

  return (
    <div className="repeat">
      {items.map((w) => (
        <div className="repeat__item" key={w.id}>
          <div className="form-grid">
            <div className="form-col">
              <Field label="ROLE" value={w.role} placeholder="Investment Analyst" onChange={(v) => setItem(w.id, { role: v })} />
              <Field label="COMPANY" value={w.company} placeholder="Allianz Global Investors" onChange={(v) => setItem(w.id, { company: v })} />
              <TextArea label="POSITION DESCRIPTION" value={w.description} rows={4} placeholder="Analyzed financial statements and market trends…" onChange={(v) => setItem(w.id, { description: v })} />
            </div>
            <div className="form-col">
              <div className="field-row">
                <Field label="START DATE" value={w.startDate} placeholder="October 2022" onChange={(v) => setItem(w.id, { startDate: v })} />
                <Field label="END DATE" value={w.endDate} placeholder="September 2025" onChange={(v) => setItem(w.id, { endDate: v })} />
              </div>
              <button className={`check-row${w.current ? " is-on" : ""}`} onClick={() => setItem(w.id, { current: !w.current })}>
                <span className="check-row__box">{w.current && <Check size={14} />}</span>
                Currently work here
              </button>
              <Field label="COUNTRY" value={w.country} placeholder="Germany" onChange={(v) => setItem(w.id, { country: v })} />
              <Field label="CITY/STATE" value={w.cityState} placeholder="Berlin" onChange={(v) => setItem(w.id, { cityState: v })} />
            </div>
          </div>
          {items.length > 1 && (
            <button className="repeat__remove" onClick={() => remove(w.id)}>Remove</button>
          )}
        </div>
      ))}
      <button className="repeat__add" onClick={add}>
        <Plus size={16} /> Add one more work experience
      </button>
    </div>
  );
}

export function EducationStep({ data, update }: StepProps) {
  const items = data.education;
  const setItem = (id: string, patch: Partial<EducationItem>) =>
    update({ education: items.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const add = () =>
    update({
      education: [
        ...items,
        { id: nanoid(), institution: "", location: "", degree: "", minor: "", startDate: "", endDate: "", grade: "", additional: "" },
      ],
    });
  const remove = (id: string) => update({ education: items.filter((e) => e.id !== id) });

  if (items.length === 0) return <EmptyState label="education" onAdd={add} />;

  return (
    <div className="repeat">
      {items.map((e) => (
        <div className="repeat__item" key={e.id}>
          <div className="form-grid">
            <div className="form-col">
              <Field label="INSTITUTION" value={e.institution} placeholder="Technical University of Munich" onChange={(v) => setItem(e.id, { institution: v })} />
              <Field label="LOCATION" value={e.location} placeholder="Munchen, Germany" onChange={(v) => setItem(e.id, { location: v })} />
              <Field label="DEGREE OR QUALIFICATION AND MAJOR" value={e.degree} placeholder="Bachelor of Science" onChange={(v) => setItem(e.id, { degree: v })} />
              <Field label="MINOR" value={e.minor} placeholder="Business Administration" onChange={(v) => setItem(e.id, { minor: v })} />
            </div>
            <div className="form-col">
              <div className="field-row">
                <Field label="START DATE" value={e.startDate} placeholder="October 2022" onChange={(v) => setItem(e.id, { startDate: v })} />
                <Field label="END DATE" value={e.endDate} placeholder="September 2025" onChange={(v) => setItem(e.id, { endDate: v })} />
              </div>
              <Field label="GRADE IF APPLICABLE (OPTIONAL)" value={e.grade} placeholder="1.3" onChange={(v) => setItem(e.id, { grade: v })} />
              <TextArea label="ADDITIONAL INFO (OPTIONAL)" value={e.additional} rows={3} placeholder="Graduated with honors, final grade 1.3" onChange={(v) => setItem(e.id, { additional: v })} />
            </div>
          </div>
          {items.length > 1 && (
            <button className="repeat__remove" onClick={() => remove(e.id)}>Remove</button>
          )}
        </div>
      ))}
      <button className="repeat__add" onClick={add}>
        <Plus size={16} /> Add one more education
      </button>
    </div>
  );
}

export function SkillsStep({ data, update }: StepProps) {
  const skills = data.skills;
  const add = (value: string) => {
    const v = value.trim();
    if (v && !skills.includes(v)) update({ skills: [...skills, v] });
  };
  const remove = (s: string) => update({ skills: skills.filter((x) => x !== s) });

  return (
    <div className="form-single">
      <label className="field">
        <span className="field__label">ADD A SKILL (PRESS ENTER)</span>
        <input
          className="field__input"
          placeholder="e.g. Financial modeling"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              add((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </label>
      <div className="skill-tags">
        {skills.map((s) => (
          <span className="skill-tag" key={s}>
            {s}
            <button onClick={() => remove(s)} aria-label={`Remove ${s}`}>×</button>
          </span>
        ))}
        {skills.length === 0 && <p className="muted">No skills yet — add your most relevant ones.</p>}
      </div>
    </div>
  );
}

export function SimpleSectionStep({
  sectionKey,
  data,
  update,
  noun,
}: StepProps & { sectionKey: SectionKey; noun: string }) {
  const items = data[sectionKey] as SimpleEntry[];
  const setItem = (id: string, patch: Partial<SimpleEntry>) =>
    update({ [sectionKey]: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } as Partial<CvData>);
  const add = () =>
    update({ [sectionKey]: [...items, { id: nanoid(), title: "", description: "", date: "" }] } as Partial<CvData>);
  const remove = (id: string) =>
    update({ [sectionKey]: items.filter((i) => i.id !== id) } as Partial<CvData>);

  if (items.length === 0) return <EmptyState label={noun} onAdd={add} />;

  return (
    <div className="repeat">
      {items.map((it) => (
        <div className="repeat__item" key={it.id}>
          <div className="form-single">
            <Field label="TITLE" value={it.title} onChange={(v) => setItem(it.id, { title: v })} />
            <Field label="DATE (OPTIONAL)" value={it.date} onChange={(v) => setItem(it.id, { date: v })} />
            <TextArea label="DESCRIPTION" value={it.description} rows={3} onChange={(v) => setItem(it.id, { description: v })} />
          </div>
          {items.length > 1 && (
            <button className="repeat__remove" onClick={() => remove(it.id)}>Remove</button>
          )}
        </div>
      ))}
      <button className="repeat__add" onClick={add}>
        <Plus size={16} /> Add one more {noun}
      </button>
    </div>
  );
}

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="empty-state">
      <p className="muted">No {label} added yet.</p>
      <button className="repeat__add" onClick={onAdd}>
        <Plus size={16} /> Add {label}
      </button>
    </div>
  );
}
