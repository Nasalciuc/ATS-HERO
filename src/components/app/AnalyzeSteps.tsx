const ANALYZE_STEPS = ["Adding CV", "ATS-Analysis", "Improvement"];

/** Three-node horizontal stepper used by the Improve / Job Fit flow (and its results). */
export default function AnalyzeSteps({ current }: { current: number }) {
  return (
    <div className="analyze-steps">
      {ANALYZE_STEPS.map((label, i) => {
        const isCurrent = i === current;
        const isDone = i < current;
        return (
          <div className="analyze-step" key={label}>
            {i > 0 && <span className={`analyze-step__line${isDone || isCurrent ? " is-filled" : ""}`} />}
            <span className={`analyze-step__node${isCurrent ? " is-current" : ""}${isDone ? " is-done" : ""}`} />
            <span className={`analyze-step__label${isCurrent || isDone ? " is-current" : ""}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
