"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import AppShell from "../components/app/AppShell";
import ProgressBar, { type Step } from "../components/app/ProgressBar";
import ProTips from "../components/app/ProTips";
import { EyeOptic, SaveDisk, ArrowUp } from "../components/figma-icons";
import TipsModal from "../components/modals/TipsModal";
import AddSectionModal from "../components/modals/AddSectionModal";
import CompleteModal from "../components/modals/CompleteModal";
import AlmostThereModal from "../components/modals/AlmostThereModal";
import { useApp } from "../store/AppContext";
import { OPTIONAL_SECTIONS, type CvData, type SectionKey, type SimpleEntry } from "../lib/types";
import {
  PersonalInfoStep,
  EducationStep,
  SummaryStep,
  WorkStep,
  SkillsStep,
  AwardsStep,
  CertificationsStep,
  PublicationsStep,
  ActivitiesStep,
  VolunteeringStep,
} from "./builder/steps";

/** An added optional section counts as "filled" when it has at least one entry with a title. */
function isSectionFilled(data: CvData, key: SectionKey): boolean {
  const list = data[key] as SimpleEntry[];
  return Array.isArray(list) && list.some((i) => i.title.trim());
}

// Stepper labels break where Figma breaks them ("Professional⏎summary").
const BASE_STEPS: { key: SectionKey; label: string; emoji: string }[] = [
  { key: "personalInfo", label: "Personal info", emoji: "🪪" },
  { key: "education", label: "Education", emoji: "🎓" },
  { key: "summary", label: "Professional\nsummary", emoji: "📋" },
  { key: "work", label: "Work\nexperience", emoji: "💼" },
  { key: "skills", label: "Skills", emoji: "💪" },
];

// Figma breaks this optional section's stepper label too.
const STEPPER_LABELS: Partial<Record<SectionKey, string>> = { activities: "Relevant\nactivities" };

// Page heading = Pro Tips badge (Figma); it can differ from the compact stepper label.
const STEP_TITLES: Partial<Record<SectionKey, string>> = {
  personalInfo: "Personal Info",
  summary: "Professional summary",
  work: "Work experience / Internship",
};

export default function BuilderPage() {
  // TODO(integration): step/section UI state is intentionally NOT lifted into
  // useBuilderStore yet. This wizard uses a key-based dynamic step model
  // (activeKey: SectionKey + addedSections), whereas the store is index-based with a
  // different OptionalSection union (includes "languages"). The template/accent state the
  // new export/preview features need already lives in useBuilderStore and is wired through
  // the cv components; lifting the wizard's step model here is risky with no functional gain.
  const { data, update, save, saving, saveError } = useApp();
  const navigate = useNavigate();

  const [activeKey, setActiveKey] = useState<SectionKey>("personalInfo");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [tips, setTips] = useState(false);
  const [addSection, setAddSection] = useState(false);
  const [complete, setComplete] = useState(false);
  const [almostThere, setAlmostThere] = useState(false);
  const [addedSections, setAddedSections] = useState<SectionKey[]>([]);

  // Optional sections that already hold entries (a saved CV, a reload) belong in the stepper.
  useEffect(() => {
    const withData = OPTIONAL_SECTIONS.map((o) => o.key).filter((k) => {
      const list = data[k] as unknown[] | undefined;
      return Array.isArray(list) && list.length > 0;
    });
    if (withData.some((k) => !addedSections.includes(k))) {
      setAddedSections((prev) => [...prev, ...withData.filter((k) => !prev.includes(k))]);
    }
  }, [data, addedSections]);

  // A new step is a new page: move focus to its title so keyboard and screen-reader users start
  // there (the button they pressed may be gone — "Next step" on the last step, a removed section)
  // and, on phones, the page scrolls back up to it. Not on the first render.
  const shownStep = useRef(activeKey);
  useEffect(() => {
    if (shownStep.current === activeKey) return;
    shownStep.current = activeKey;
    document.querySelector<HTMLElement>('[data-figma="title"]')?.focus();
  }, [activeKey]);

  const steps: Step[] = useMemo(() => {
    const optional = (keys: SectionKey[]) =>
      OPTIONAL_SECTIONS.filter((o) => keys.includes(o.key) && addedSections.includes(o.key)).map((o) => ({
        key: o.key,
        label: STEPPER_LABELS[o.key] ?? o.label,
        emoji: o.emoji,
      }));
    const core = BASE_STEPS.slice(0, 4);
    const skills = BASE_STEPS.slice(4);
    return [...core, ...optional(["activities"]), ...skills, ...optional(["awards", "certifications", "publications", "volunteering"])];
  }, [addedSections]);

  const activeIndex = steps.findIndex((s) => s.key === activeKey);
  const isLast = activeIndex === steps.length - 1;
  const activeStep = steps[activeIndex];
  // Figma: "Complete" appears once the core steps are done — on Skills and every section after it.
  const canComplete = activeIndex >= steps.findIndex((s) => s.key === "skills");
  // Figma keeps the form card at 480 from Skills on (and on the optional sections) so the footer doesn't jump.
  const tall = activeKey === "skills" || addedSections.includes(activeKey);

  const goTo = (key: string) => setActiveKey(key as SectionKey);
  const markDoneAnd = (next?: string) => {
    setCompleted((prev) => new Set(prev).add(activeKey));
    if (next) setActiveKey(next as SectionKey);
  };

  const hasUnfilledOptional = addedSections.some((k) => !isSectionFilled(data, k));

  const finish = () => {
    markDoneAnd();
    if (hasUnfilledOptional) setAlmostThere(true);
    else setComplete(true);
  };

  const next = () => {
    if (isLast) {
      finish();
    } else {
      markDoneAnd(steps[activeIndex + 1].key);
    }
  };
  const back = () => {
    if (activeIndex > 0) setActiveKey(steps[activeIndex - 1].key as SectionKey);
  };

  const availableToAdd = OPTIONAL_SECTIONS.map((o) => o.key).filter(
    (k) => !addedSections.includes(k)
  );

  const onAddSection = (keys: SectionKey[]) => {
    if (keys.length === 0) return;
    setAddedSections((prev) => [...prev, ...keys.filter((k) => !prev.includes(k))]);
    setAddSection(false);
    setActiveKey(keys[0]);
  };

  const onRemoveSection = (key: SectionKey) => {
    setAddedSections((prev) => prev.filter((k) => k !== key));
    update({ [key]: [] } as Partial<CvData>);
    if (activeKey === key) {
      const idx = steps.findIndex((s) => s.key === key);
      setActiveKey((steps[idx - 1]?.key ?? "skills") as SectionKey);
    }
  };

  const optionalKeys = new Set<string>(addedSections);

  const renderStep = () => {
    const props = { data, update, framed: true };
    switch (activeKey) {
      case "personalInfo":
        return <PersonalInfoStep key="personalInfo" {...props} />;
      case "education":
        return <EducationStep key="education" {...props} />;
      case "summary":
        return <SummaryStep key="summary" {...props} />;
      case "work":
        return <WorkStep key="work" {...props} />;
      case "skills":
        return <SkillsStep key="skills" {...props} />;
      case "awards":
        return <AwardsStep key="awards" {...props} />;
      case "certifications":
        return <CertificationsStep key="certifications" {...props} />;
      case "publications":
        return <PublicationsStep key="publications" {...props} />;
      case "activities":
        return <ActivitiesStep key="activities" {...props} />;
      case "volunteering":
        return <VolunteeringStep key="volunteering" {...props} />;
      default:
        return <PersonalInfoStep key="personalInfo" {...props} />;
    }
  };

  const showActivitiesPrompt = activeKey === "work" && !addedSections.includes("activities");

  const pageTitle =
    (activeStep && (STEP_TITLES[activeStep.key as SectionKey] ?? activeStep.label)) ?? "Create CV";

  return (
    <AppShell
      title={pageTitle}
      active="create"
      actions={
        <>
          <button className="topbtn topbtn--title topbtn--ghost" data-figma="btn-preview" onClick={() => setComplete(true)}>
            <EyeOptic /> Preview
          </button>
          <button
            className="topbtn topbtn--title topbtn--dark"
            data-figma="btn-save"
            onClick={() => void save()}
            title={saveError ? `Not saved: ${saveError}` : undefined}
          >
            <SaveDisk /> {saving ? "Saving…" : saveError ? "Retry save" : "Save"}
          </button>
        </>
      }
    >
      <ProgressBar
        steps={steps}
        current={activeKey}
        completed={completed}
        optional={optionalKeys}
        onSelect={goTo}
        onAddSection={() => setAddSection(true)}
        onRemoveSection={(k) => onRemoveSection(k as SectionKey)}
      />

      <div className={`builder${tall ? " builder--tall" : ""}`}>
        <ProTips
          badge={pageTitle}
          onExplore={() => setTips(true)}
          extra={
            showActivitiesPrompt
              ? {
                  title: "Activities",
                  body: "Have relevant experience beyond paid roles? Add new section to showcase your involvement.",
                  onAdd: () => onAddSection(["activities"]),
                }
              : undefined
          }
        />

        <div className="builder__main">{renderStep()}</div>
      </div>

      <div className="builder__footer">
        <div>
          {activeIndex > 0 ? (
            <button className="topbtn topbtn--step topbtn--ghost" data-figma="btn-back" onClick={back}>
              <ArrowUp className="topbtn__arrow--left" /> Back
            </button>
          ) : null}
        </div>
        <div className="builder__footer__actions">
          {!isLast && (
            <button className="topbtn topbtn--step topbtn--ghost" data-figma="btn-next" onClick={next}>
              Next step <ArrowUp className="topbtn__arrow--right" />
            </button>
          )}
          {canComplete && (
            <button className="topbtn topbtn--step topbtn--dark" data-figma="btn-complete" onClick={finish}>
              Complete
            </button>
          )}
        </div>
      </div>

      <TipsModal open={tips} onClose={() => setTips(false)} section={activeKey} />
      <AddSectionModal
        open={addSection}
        onClose={() => setAddSection(false)}
        available={availableToAdd}
        onAdd={onAddSection}
      />
      <AlmostThereModal
        open={almostThere}
        onClose={() => setAlmostThere(false)}
        onContinueEditing={() => setAlmostThere(false)}
        onCompleteAnyway={() => {
          setAlmostThere(false);
          setComplete(true);
        }}
      />
      <CompleteModal
        open={complete}
        onClose={() => setComplete(false)}
        data={data}
        onScore={() => {
          setComplete(false);
          sessionStorage.removeItem("ats_report");
          sessionStorage.removeItem("ats_jobfit");
          sessionStorage.setItem("ats_flow", "create");
          navigate("/app/score");
        }}
      />
    </AppShell>
  );
}
