import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import ProgressBar, { type Step } from "../components/app/ProgressBar";
import ProTips from "../components/app/ProTips";
import { Eye, Save, ArrowLeft, ArrowRight } from "../components/icons";
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

const BASE_STEPS: { key: SectionKey; label: string; emoji: string }[] = [
  { key: "personalInfo", label: "Personal info", emoji: "🪪" },
  { key: "education", label: "Education", emoji: "🎓" },
  { key: "summary", label: "Professional summary", emoji: "📝" },
  { key: "work", label: "Work experience", emoji: "💼" },
  { key: "skills", label: "Skills", emoji: "💪" },
];

// The page heading can differ from the compact stepper label (Figma).
const STEP_TITLES: Partial<Record<SectionKey, string>> = {
  work: "Work experience / Internship",
};

export default function BuilderPage() {
  const { data, update, save, saving } = useApp();
  const navigate = useNavigate();

  const [activeKey, setActiveKey] = useState<SectionKey>("personalInfo");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [tips, setTips] = useState(false);
  const [addSection, setAddSection] = useState(false);
  const [complete, setComplete] = useState(false);
  const [almostThere, setAlmostThere] = useState(false);
  const [addedSections, setAddedSections] = useState<SectionKey[]>([]);

  const steps: Step[] = useMemo(() => {
    const optional = (keys: SectionKey[]) =>
      OPTIONAL_SECTIONS.filter((o) => keys.includes(o.key) && addedSections.includes(o.key)).map((o) => ({
        key: o.key,
        label: o.label,
        emoji: o.emoji,
      }));
    const core = BASE_STEPS.slice(0, 4);
    const skills = BASE_STEPS.slice(4);
    return [...core, ...optional(["activities"]), ...skills, ...optional(["awards", "certifications", "publications", "volunteering"])];
  }, [addedSections]);

  const activeIndex = steps.findIndex((s) => s.key === activeKey);
  const isLast = activeIndex === steps.length - 1;
  const activeStep = steps[activeIndex];

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
    switch (activeKey) {
      case "personalInfo":
        return <PersonalInfoStep data={data} update={update} />;
      case "education":
        return <EducationStep data={data} update={update} />;
      case "summary":
        return <SummaryStep data={data} update={update} />;
      case "work":
        return <WorkStep data={data} update={update} />;
      case "skills":
        return <SkillsStep data={data} update={update} />;
      case "awards":
        return <AwardsStep data={data} update={update} />;
      case "certifications":
        return <CertificationsStep data={data} update={update} />;
      case "publications":
        return <PublicationsStep data={data} update={update} />;
      case "activities":
        return <ActivitiesStep data={data} update={update} />;
      case "volunteering":
        return <VolunteeringStep data={data} update={update} />;
      default:
        return <PersonalInfoStep data={data} update={update} />;
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
          <button className="topbtn topbtn--ghost" onClick={() => setComplete(true)}>
            <Eye size={18} /> Preview
          </button>
          <button className="topbtn topbtn--dark" onClick={() => void save()}>
            <Save size={18} /> {saving ? "Saving…" : "Save"}
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

      <div className="builder">
        <ProTips
          badge={activeStep?.label ?? ""}
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

        <div className="builder__panel">{renderStep()}</div>
      </div>

      <div className="builder__footer">
        <div>
          {activeIndex > 0 ? (
            <button className="topbtn topbtn--ghost" onClick={back}>
              <ArrowLeft size={18} /> Back
            </button>
          ) : null}
        </div>
        <div className="builder__footer__actions">
          {!isLast && (
            <button className="topbtn topbtn--ghost" onClick={next}>
              Next step <ArrowRight size={18} />
            </button>
          )}
          <button className="topbtn topbtn--dark" onClick={finish}>
            Complete
          </button>
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
