import Modal from "../ui/Modal";
import type { SectionKey } from "../../lib/types";

type TipGroup = { label: string; tips: { text: string; hint?: string }[] };

const TIPS: Partial<Record<SectionKey, TipGroup[]>> = {
  personalInfo: [
    { label: "Name", tips: [{ text: "Use your real full name — avoid nicknames" }] },
    {
      label: "Email",
      tips: [
        { text: "Use a professional email (e.g. name.surname@gmail.com)" },
        { text: "Avoid informal emails (e.g. coolguy123@gmail.com)", hint: "It shapes your first impression before anything else" },
      ],
    },
    {
      label: "Phone",
      tips: [{ text: "Choose a number where you're actually reachable. Even if it's via messaging.", hint: "it's better than a number no one can reach" }],
    },
    {
      label: "Linkedin",
      tips: [{ text: "Customize your LinkedIn URL for a cleaner look", hint: "Recruiters often verify your experience here" }],
    },
    {
      label: "Personal website",
      tips: [
        { text: "Include links to your portfolio (Behance, Dribbble), case studies (Notion or personal site), or Figma projects" },
        { text: "Add GitHub, live projects, or product launches if relevant", hint: "Demonstrates real experience, not just claims" },
      ],
    },
  ],
  summary: [
    { label: "Position", tips: [{ text: "Name the exact role you're targeting" }] },
    {
      label: "Value proposition",
      tips: [
        { text: "Lead with your strongest, most relevant achievement" },
        { text: "Quantify impact with numbers, %, or scale", hint: "Recruiters scan for measurable results" },
      ],
    },
  ],
  work: [
    {
      label: "Descriptions",
      tips: [
        { text: "Start each bullet with a strong action verb" },
        { text: "Show measurable impact (increased X by Y%)", hint: "Results beat responsibilities" },
      ],
    },
  ],
};

const GENERIC: TipGroup[] = [
  {
    label: "Tips",
    tips: [
      { text: "Keep entries concise and relevant to your target role" },
      { text: "Use consistent formatting and dates", hint: "ATS parsers prefer clean structure" },
    ],
  },
];

export default function TipsModal({
  open,
  onClose,
  section,
}: {
  open: boolean;
  onClose: () => void;
  section: SectionKey;
}) {
  const groups = TIPS[section] ?? GENERIC;
  return (
    <Modal open={open} onClose={onClose} variant="center" width={620}>
      <div className="tips">
        <h2 className="tips__title">Pro Tips</h2>
        {groups.map((g) => (
          <div className="tips__group" key={g.label}>
            <span className="tips__badge">{g.label}</span>
            {g.tips.map((t, i) => (
              <div className="tips__row" key={i}>
                <p className="tips__text">
                  <span className="tips__num">({i + 1})</span> {t.text}
                </p>
                {t.hint && <p className="tips__hint">👉 {t.hint}</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
