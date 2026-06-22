import { Plus, Check } from "../icons";

export type Step = { key: string; label: string; emoji: string };

export default function ProgressBar({
  steps,
  current,
  completed,
  onSelect,
  onAddSection,
}: {
  steps: Step[];
  current: string;
  completed: Set<string>;
  onSelect: (key: string) => void;
  onAddSection: () => void;
}) {
  return (
    <div className="progress">
      <div className="progress__track">
        {steps.map((s, i) => {
          const isCurrent = s.key === current;
          const isDone = completed.has(s.key) && !isCurrent;
          return (
            <div className="progress__step" key={s.key}>
              {i > 0 && <span className={`progress__line${isDone || isCurrent ? " is-filled" : ""}`} />}
              <button
                className={`progress__node${isCurrent ? " is-current" : ""}${isDone ? " is-done" : ""}`}
                onClick={() => onSelect(s.key)}
              >
                <span className="progress__emoji">{s.emoji}</span>
                {isDone && <span className="progress__check"><Check size={12} /></span>}
              </button>
              <span className={`progress__label${isCurrent ? " is-current" : ""}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      <button className="progress__add" onClick={onAddSection}>
        <span className="progress__add-node"><Plus size={18} /></span>
        <span className="progress__add-label">Add section</span>
      </button>
    </div>
  );
}
