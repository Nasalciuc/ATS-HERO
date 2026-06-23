import { Plus } from "../icons";

export type Step = { key: string; label: string; emoji: string };

export default function ProgressBar({
  steps,
  current,
  completed,
  optional,
  onSelect,
  onAddSection,
  onRemoveSection,
}: {
  steps: Step[];
  current: string;
  completed: Set<string>;
  optional?: Set<string>;
  onSelect: (key: string) => void;
  onAddSection: () => void;
  onRemoveSection?: (key: string) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="progress">
      <div className="progress__scroll">
        <div className="progress__track">
        {steps.map((s, i) => {
          const isCurrent = s.key === current;
          const isDone = completed.has(s.key) && !isCurrent;
          const isOptional = optional?.has(s.key) ?? false;
          const lineFilled =
            i > 0 &&
            (completed.has(steps[i - 1].key) || isCurrent || isDone || i <= currentIndex);
          return (
            <div className="progress__step" key={s.key}>
              {i > 0 && <span className={`progress__line${lineFilled ? " is-filled" : ""}`} />}
              {isOptional && onRemoveSection && (
                <button
                  className="progress__remove"
                  onClick={() => onRemoveSection(s.key)}
                  aria-label={`Remove ${s.label}`}
                >
                  ×
                </button>
              )}
              <button
                className={`progress__node${isCurrent ? " is-current" : ""}${isDone ? " is-done" : ""}`}
                onClick={() => onSelect(s.key)}
              >
                <span className="progress__emoji" aria-hidden>
                  {s.emoji}
                </span>
              </button>
              <span className={`progress__label${isCurrent ? " is-current" : ""}`}>{s.label}</span>
            </div>
          );
        })}
        </div>
      </div>

      <button className="progress__add" onClick={onAddSection}>
        <span className="progress__add-node"><Plus size={18} /></span>
        <span className="progress__add-label">Add section</span>
      </button>
    </div>
  );
}
