import type {AlgorithmTraceStep} from "@/lib/algorithm-zoo";

export function AlgorithmTraceStepper({
  trace,
  activeStep,
  onStepChange,
}: {
  trace: readonly AlgorithmTraceStep[];
  activeStep: number;
  onStepChange: (step: number) => void;
}) {
  if (trace.length === 0) {
    return (
      <section className="algorithm-zoo-trace" aria-label="Algorithm trace step-through">
        <h4>Shared step-through</h4>
        <p>No intermediate trace steps for this fixture.</p>
      </section>
    );
  }

  const index = Math.max(0, Math.min(activeStep, trace.length - 1));
  const step = trace[index]!;

  return (
    <section className="algorithm-zoo-trace" aria-label="Algorithm trace step-through">
      <div className="algorithm-zoo-step-heading">
        <h4>Shared step-through</h4>
        <span>Step {index + 1} of {trace.length}</span>
      </div>

      <div className="algorithm-zoo-step-tabs" role="group" aria-label="Algorithm intermediate states">
        {trace.map((candidate, candidateIndex) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidateIndex === index}
            onClick={() => onStepChange(candidateIndex)}
          >
            <span>{candidateIndex + 1}</span>
            {candidate.label}
          </button>
        ))}
      </div>

      <article className="algorithm-zoo-active-step" aria-live="polite">
        <strong>{step.label}</strong>
        <p>{step.summary}</p>
      </article>

      <div className="algorithm-zoo-step-actions">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onStepChange(index - 1)}
        >
          Previous step
        </button>
        <span>{step.id}</span>
        <button
          type="button"
          disabled={index === trace.length - 1}
          onClick={() => onStepChange(index + 1)}
        >
          Next step
        </button>
      </div>
    </section>
  );
}
