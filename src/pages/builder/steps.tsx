import { useState, type ReactNode } from "react";
import { nanoid } from "nanoid";
import { Field, TextArea } from "../../components/app/Field";
import { Check, Plus, Upload, Trash, BriefcaseSm, PersonSm, FolderSm, Globe } from "../../components/icons";
import type {
  CvData,
  EducationItem,
  LanguageItem,
  SectionKey,
  SimpleEntry,
  WorkItem,
} from "../../lib/types";

type StepProps = { data: CvData; update: (patch: Partial<CvData>) => void };

/** Multiple entries shown as tabs (Figma): tab bar on top, one form below, Delete bottom-right. */
function TabbedRepeat<T extends { id: string }>({
  items,
  tabLabel,
  addLabel,
  onAdd,
  onRemove,
  renderItem,
}: {
  items: T[];
  tabLabel: (item: T, index: number) => string;
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  renderItem: (item: T) => ReactNode;
}) {
  const [active, setActive] = useState(0);
  const idx = Math.min(active, items.length - 1);
  const item = items[idx];

  return (
    <div className="repeat-tabs">
      {items.length > 1 && (
        <div className="repeat-tabs__bar">
          {items.map((it, i) => (
            <button
              key={it.id}
              className={`repeat-tabs__tab${i === idx ? " is-active" : ""}`}
              onClick={() => setActive(i)}
              title={tabLabel(it, i)}
            >
              {tabLabel(it, i) || `Entry ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {item && <div className="repeat-tabs__panel">{renderItem(item)}</div>}

      <div className="repeat-tabs__foot">
        <button
          className="repeat__add"
          onClick={() => {
            onAdd();
            setActive(items.length);
          }}
        >
          <Plus size={16} /> {addLabel}
        </button>
        {items.length > 1 && item && (
          <button
            className="repeat-tabs__delete"
            onClick={() => {
              onRemove(item.id);
              setActive(0);
            }}
          >
            <Trash size={15} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}

type TagTone = "green" | "blue" | "amber" | "violet";

const TAG_ICONS: Record<TagTone, ReactNode> = {
  green: <BriefcaseSm size={13} />,
  amber: <PersonSm size={13} />,
  blue: <FolderSm size={13} />,
  violet: <Globe size={13} />,
};

/** Chip input: type + Enter to add a tag, click × to remove. Matches Figma skill groups. */
function TagInput({
  label,
  placeholder,
  tags,
  tone,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  tone: TagTone;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
      {tags.length > 0 && (
        <div className="skill-tags">
          {tags.map((t) => (
            <span className={`skill-tag skill-tag--${tone}`} key={t}>
              {TAG_ICONS[tone]}
              {t}
              <button onClick={() => onRemove(t)} aria-label={`Remove ${t}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

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
          <button className="field__upload">
            <Upload size={16} /> Upload
          </button>
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
    <TabbedRepeat
      items={items}
      tabLabel={(w) => w.company || w.role || "Work"}
      addLabel="Add one more work experience"
      onAdd={add}
      onRemove={remove}
      renderItem={(w) => (
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
      )}
    />
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
    <TabbedRepeat
      items={items}
      tabLabel={(e) => e.institution || e.degree || "Education"}
      addLabel="Add one more education"
      onAdd={add}
      onRemove={remove}
      renderItem={(e) => (
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
      )}
    />
  );
}

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];

export function SkillsStep({ data, update }: StepProps) {
  const addTo = (key: "skills" | "instruments" | "softSkills", value: string) => {
    const v = value.trim();
    if (v && !data[key].includes(v)) update({ [key]: [...data[key], v] } as Partial<CvData>);
  };
  const removeFrom = (key: "skills" | "instruments" | "softSkills", value: string) =>
    update({ [key]: data[key].filter((x) => x !== value) } as Partial<CvData>);

  const languages = data.languages;
  const setLang = (id: string, patch: Partial<LanguageItem>) =>
    update({ languages: languages.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLang = () =>
    update({ languages: [...languages, { id: nanoid(), name: "", level: "B2" }] });
  const removeLang = (id: string) =>
    update({ languages: languages.filter((l) => l.id !== id) });

  return (
    <div className="form-grid">
      <div className="form-col">
        <TagInput
          label="HARD SKILLS"
          placeholder="Add skills"
          tone="green"
          tags={data.skills}
          onAdd={(v) => addTo("skills", v)}
          onRemove={(v) => removeFrom("skills", v)}
        />
        <TagInput
          label="SOFT SKILLS"
          placeholder="Add skills"
          tone="amber"
          tags={data.softSkills}
          onAdd={(v) => addTo("softSkills", v)}
          onRemove={(v) => removeFrom("softSkills", v)}
        />
      </div>
      <div className="form-col">
        <TagInput
          label="INSTRUMENTS"
          placeholder="Add skills"
          tone="blue"
          tags={data.instruments}
          onAdd={(v) => addTo("instruments", v)}
          onRemove={(v) => removeFrom("instruments", v)}
        />
        <div className="field">
          <span className="field__label">LANGUAGES</span>
          {languages.map((l) => (
            <div className="lang-row" key={l.id}>
              <input
                className="field__input"
                placeholder="English"
                value={l.name}
                onChange={(e) => setLang(l.id, { name: e.target.value })}
              />
              <select
                className="field__input field__select"
                value={l.level}
                onChange={(e) => setLang(l.id, { level: e.target.value })}
              >
                {LANGUAGE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
              <button className="lang-row__remove" onClick={() => removeLang(l.id)} aria-label="Remove language">
                ×
              </button>
            </div>
          ))}
          <button className="repeat__add" onClick={addLang}>
            <Plus size={16} /> Add language
          </button>
        </div>
      </div>
    </div>
  );
}

/** Generic repeatable list of SimpleEntry-based sections (awards/certs/publications). */
function useEntryList(
  sectionKey: SectionKey,
  data: CvData,
  update: (patch: Partial<CvData>) => void
) {
  const items = data[sectionKey] as SimpleEntry[];
  const setItem = (id: string, patch: Partial<SimpleEntry>) =>
    update({ [sectionKey]: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } as Partial<CvData>);
  const add = () =>
    update({ [sectionKey]: [...items, { id: nanoid(), title: "", description: "", date: "" }] } as Partial<CvData>);
  const remove = (id: string) =>
    update({ [sectionKey]: items.filter((i) => i.id !== id) } as Partial<CvData>);
  return { items, setItem, add, remove };
}

function PhotoField() {
  return (
    <div className="field">
      <span className="field__label">PHOTO (OPTIONAL)</span>
      <button className="field__upload">
        <Upload size={16} /> Upload
      </button>
    </div>
  );
}

export function AwardsStep({ data, update }: StepProps) {
  const { items, setItem, add, remove } = useEntryList("awards", data, update);
  if (items.length === 0) return <EmptyState label="award" onAdd={add} />;
  return (
    <TabbedRepeat
      items={items}
      tabLabel={(it) => it.title || "Award"}
      addLabel="Add one more award"
      onAdd={add}
      onRemove={remove}
      renderItem={(it) => (
        <div className="form-grid">
          <div className="form-col">
            <Field label="AWARD OR SCHOLARSHIP" value={it.title} placeholder="Dean's List" onChange={(v) => setItem(it.id, { title: v })} />
            <Field label="ORGANISATION" value={it.organisation ?? ""} placeholder="Technical University of Munich" onChange={(v) => setItem(it.id, { organisation: v })} />
          </div>
          <div className="form-col">
            <Field label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => setItem(it.id, { date: v })} />
            <PhotoField />
          </div>
        </div>
      )}
    />
  );
}

export function CertificationsStep({ data, update }: StepProps) {
  const { items, setItem, add, remove } = useEntryList("certifications", data, update);
  if (items.length === 0) return <EmptyState label="certification" onAdd={add} />;
  return (
    <TabbedRepeat
      items={items}
      tabLabel={(it) => it.title || "Certification"}
      addLabel="Add one more certification"
      onAdd={add}
      onRemove={remove}
      renderItem={(it) => (
        <div className="form-grid">
          <div className="form-col">
            <Field label="CERTIFICATION" value={it.title} placeholder="AWS Certified Solutions Architect" onChange={(v) => setItem(it.id, { title: v })} />
            <Field label="ISSUED INSTITUTION" value={it.issuer ?? ""} placeholder="Amazon Web Services" onChange={(v) => setItem(it.id, { issuer: v })} />
          </div>
          <div className="form-col">
            <Field label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => setItem(it.id, { date: v })} />
            <PhotoField />
          </div>
        </div>
      )}
    />
  );
}

export function PublicationsStep({ data, update }: StepProps) {
  const { items, setItem, add, remove } = useEntryList("publications", data, update);
  if (items.length === 0) return <EmptyState label="publication" onAdd={add} />;
  return (
    <TabbedRepeat
      items={items}
      tabLabel={(it) => it.title || "Publication"}
      addLabel="Add one more publication"
      onAdd={add}
      onRemove={remove}
      renderItem={(it) => (
        <div className="form-grid">
          <div className="form-col">
            <Field label="PUBLICATION" value={it.title} placeholder="Machine Learning in Finance" onChange={(v) => setItem(it.id, { title: v })} />
            <Field label="PUBLISHER" value={it.publisher ?? ""} placeholder="IEEE" onChange={(v) => setItem(it.id, { publisher: v })} />
            <Field label="LINK" value={it.link ?? ""} placeholder="https://doi.org/…" onChange={(v) => setItem(it.id, { link: v })} />
          </div>
          <div className="form-col">
            <Field label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => setItem(it.id, { date: v })} />
            <PhotoField />
          </div>
        </div>
      )}
    />
  );
}

const ACTIVITY_TYPES = ["Competition", "Research", "Hackathon", "Club / Society", "Project", "Mentorship", "Other"];

export function ActivitiesStep({ data, update }: StepProps) {
  const { items, setItem, add, remove } = useEntryList("activities", data, update);
  if (items.length === 0) return <EmptyState label="activity" onAdd={add} />;
  return (
    <TabbedRepeat
      items={items}
      tabLabel={(it) => it.title || it.activityType || "Activity"}
      addLabel="Add one more activity"
      onAdd={add}
      onRemove={remove}
      renderItem={(it) => (
        <div className="form-grid">
          <div className="form-col">
            <div className="field">
              <span className="field__label">ACTIVITY TYPE</span>
              <select
                className="field__input field__select"
                value={it.activityType ?? ""}
                onChange={(e) => setItem(it.id, { activityType: e.target.value })}
              >
                <option value="">Select type</option>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <Field label="ROLE/CONTRIBUTION" value={it.role ?? ""} placeholder="Equity Research Analyst" onChange={(v) => setItem(it.id, { role: v })} />
            <TextArea label="DESCRIPTION" rows={4} value={it.description} placeholder="Conducted financial analysis of a publicly traded company…" onChange={(v) => setItem(it.id, { description: v })} />
          </div>
          <div className="form-col">
            <Field label="ORGANIZATION" value={it.title} placeholder="CFA Institute Research Challenge" onChange={(v) => setItem(it.id, { title: v })} />
            <Field label="LOCATION" value={it.location ?? ""} placeholder="Munich, Germany" onChange={(v) => setItem(it.id, { location: v })} />
            <div className="field-row">
              <Field label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => setItem(it.id, { date: v })} />
              <Field label="END DATE" value={it.endDate ?? ""} placeholder="—" onChange={(v) => setItem(it.id, { endDate: v })} />
            </div>
            <button className={`check-row${it.ongoing ? " is-on" : ""}`} onClick={() => setItem(it.id, { ongoing: !it.ongoing })}>
              <span className="check-row__box">{it.ongoing && <Check size={14} />}</span>
              Ongoing
            </button>
          </div>
        </div>
      )}
    />
  );
}

export function VolunteeringStep({ data, update }: StepProps) {
  const { items, setItem, add, remove } = useEntryList("volunteering", data, update);
  if (items.length === 0) return <EmptyState label="volunteering entry" onAdd={add} />;
  return (
    <TabbedRepeat
      items={items}
      tabLabel={(it) => it.title || "Volunteering"}
      addLabel="Add one more volunteering entry"
      onAdd={add}
      onRemove={remove}
      renderItem={(it) => (
        <div className="form-grid">
          <div className="form-col">
            <Field label="ORGANIZATION" value={it.title} placeholder="Red Cross" onChange={(v) => setItem(it.id, { title: v })} />
            <Field label="ROLE" value={it.role ?? ""} placeholder="Volunteer Coordinator" onChange={(v) => setItem(it.id, { role: v })} />
            <TextArea label="DESCRIPTION" rows={4} value={it.description} placeholder="Coordinated a team of 12 volunteers for community outreach…" onChange={(v) => setItem(it.id, { description: v })} />
          </div>
          <div className="form-col">
            <Field label="LOCATION" value={it.location ?? ""} placeholder="Berlin, Germany" onChange={(v) => setItem(it.id, { location: v })} />
            <div className="field-row">
              <Field label="START DATE" value={it.date} placeholder="October 2022" onChange={(v) => setItem(it.id, { date: v })} />
              <Field label="END DATE" value={it.endDate ?? ""} placeholder="—" onChange={(v) => setItem(it.id, { endDate: v })} />
            </div>
            <button className={`check-row${it.ongoing ? " is-on" : ""}`} onClick={() => setItem(it.id, { ongoing: !it.ongoing })}>
              <span className="check-row__box">{it.ongoing && <Check size={14} />}</span>
              Ongoing
            </button>
          </div>
        </div>
      )}
    />
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
