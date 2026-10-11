"use client";
import { Fragment, useEffect, useRef } from "react";
import { PlusOutline } from "../figma-icons";

/** `label` may contain "\n" — the stepper breaks lines where Figma does ("Professional\nsummary"). */
export type Step = { key: string; label: string; emoji: string };

/**
 * Figma "Progressbar": 64px tabs (circle + label) joined by 46px connectors; the last connector
 * stretches so "Add section" sits at the right edge. Steps scroll sideways when they don't fit.
 */
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // When the steps overflow (phones, many optional sections), keep the current one in view.
  useEffect(() => {
    const box = scrollRef.current;
    const node = box?.querySelector<HTMLElement>(".progress__node.is-current");
    if (!box || !node) return;
    const b = box.getBoundingClientRect();
    const n = node.getBoundingClientRect();
    if (n.left >= b.left && n.right <= b.right) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: box.scrollLeft + n.left - b.left - (b.width - n.width) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [current, steps.length]);

  return (
    <div className="progress" data-figma="stepper">
      <div className="progress__scroll" ref={scrollRef}>
        <div className="progress__track">
          {steps.map((s, i) => {
            const isCurrent = s.key === current;
            const isDone = completed.has(s.key) && !isCurrent;
            const isOptional = optional?.has(s.key) ?? false;
            const name = s.label.replace(/\n/g, " ");
            // A connector is green once the step it leads to has been reached (or either end is done).
            const lineFilled =
              i > 0 && (i <= currentIndex || completed.has(steps[i - 1].key) || completed.has(s.key));
            return (
              <Fragment key={s.key}>
                {i > 0 && <span className={`progress__line${lineFilled ? " is-filled" : ""}`} aria-hidden="true" />}
                <div className="progress__step">
                  <button
                    type="button"
                    className={`progress__node${isCurrent ? " is-current" : ""}${isDone ? " is-done" : ""}`}
                    data-figma={`step-${i}`}
                    aria-label={name}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => onSelect(s.key)}
                  >
                    <span className="progress__emoji" aria-hidden="true">
                      {s.emoji}
                    </span>
                  </button>
                  {isOptional && onRemoveSection && (
                    <button
                      type="button"
                      className="progress__remove"
                      onClick={() => onRemoveSection(s.key)}
                      aria-label={`Remove ${name}`}
                    >
                      ×
                    </button>
                  )}
                  <span className={`progress__label${isCurrent ? " is-current" : ""}`} data-figma={`step-label-${i}`}>
                    {s.label}
                  </span>
                </div>
              </Fragment>
            );
          })}
          <span className="progress__line progress__line--tail" aria-hidden="true" />
        </div>
      </div>

      <button type="button" className="progress__add" onClick={onAddSection}>
        <span className="progress__add-node" data-figma="step-add">
          <PlusOutline />
        </span>
        <span className="progress__add-label">Add section</span>
      </button>
    </div>
  );
}
