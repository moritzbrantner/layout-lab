"use client";

import {useState} from "react";
import {
  buildFlexAlgorithmPipeline,
  buildGridAlgorithmPipeline,
  type AlgorithmPipeline,
  type AlgorithmScenario,
} from "@/lib/algorithm-pipeline";

function PipelineGraph({pipeline, activePhase}: {pipeline: AlgorithmPipeline; activePhase: number}) {
  const nodeById = new Map(pipeline.nodes.map((node) => [node.id, node]));
  const feedbackEdges = pipeline.edges.filter((edge) => edge.kind === "feedback");

  return (
    <div className="algorithm-pipeline-graph" aria-label={`${pipeline.title} dependency graph`}>
      {pipeline.phases.map((phase, phaseIndex) => {
        const phaseNodes = pipeline.nodes.filter((node) => node.phase === phase.id);
        return (
          <section
            className="algorithm-phase"
            data-active={phaseIndex === activePhase ? "true" : "false"}
            key={phase.id}
            aria-label={phase.label}
          >
            <div className="algorithm-phase-heading">
              <span className="algorithm-phase-number">{phaseIndex + 1}</span>
              <div>
                <h3>{phase.label}</h3>
                <p>{phase.summary}</p>
              </div>
            </div>

            <div className="algorithm-node-list">
              {phaseNodes.map((node) => {
                const incoming = pipeline.edges.filter((edge) => edge.to === node.id && edge.kind === "dependency");
                return (
                  <article className="algorithm-node" data-kind={node.kind} key={node.id}>
                    <div className="algorithm-node-kind">{node.kind}</div>
                    <h4>{node.label}</h4>
                    <p>{node.detail}</p>
                    {incoming.length > 0 ? (
                      <div className="algorithm-node-dependencies">
                        {incoming.map((edge) => (
                          <span key={`${edge.from}-${edge.to}`}>
                            {nodeById.get(edge.from)?.label ?? edge.from} → {edge.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <aside className="algorithm-feedback" aria-label="Iterative feedback dependencies">
        <strong>Feedback edge</strong>
        {feedbackEdges.length > 0 ? feedbackEdges.map((edge) => (
          <p key={`${edge.from}-${edge.to}`}>
            {nodeById.get(edge.from)?.label ?? edge.from} ↺ {nodeById.get(edge.to)?.label ?? edge.to}: {edge.label}
          </p>
        )) : <p>This preset resolves without another iteration.</p>}
      </aside>
    </div>
  );
}

export function AlgorithmPipelineExperiment() {
  const [scenario, setScenario] = useState<AlgorithmScenario>("flex");
  const [innerSize, setInnerSize] = useState(520);
  const [gapSize, setGapSize] = useState(16);
  const [activePhase, setActivePhase] = useState(0);
  const pipeline = scenario === "flex"
    ? buildFlexAlgorithmPipeline({innerSize, gapSize})
    : buildGridAlgorithmPipeline({innerSize, gapSize});

  const selectScenario = (nextScenario: AlgorithmScenario) => {
    setScenario(nextScenario);
    setActivePhase(0);
  };

  return (
    <section className="algorithm-pipeline-shell" id="algorithm-pipeline">
      <div className="algorithm-pipeline-intro">
        <div>
          <div className="eyebrow">Algorithm explorer</div>
          <h2>{pipeline.title}</h2>
          <p>{pipeline.summary}</p>
        </div>
        <p className="algorithm-boundary-note">
          This graph explains Layout Lab&apos;s deterministic model. Browser-owned text and intrinsic measurement stay outside this graph until they are supplied as explicit inputs.
        </p>
      </div>

      <div className="algorithm-controls">
        <div className="algorithm-scenario-switch" role="group" aria-label="Layout algorithm">
          <button type="button" aria-pressed={scenario === "flex"} onClick={() => selectScenario("flex")}>Flexbox</button>
          <button type="button" aria-pressed={scenario === "grid"} onClick={() => selectScenario("grid")}>Grid</button>
        </div>

        <label>
          <span>Container size</span>
          <input
            type="range"
            min={360}
            max={760}
            step={10}
            value={innerSize}
            onChange={(event) => setInnerSize(Number(event.target.value))}
          />
          <output>{innerSize}px</output>
        </label>

        <label>
          <span>Gap</span>
          <input
            type="range"
            min={0}
            max={40}
            step={2}
            value={gapSize}
            onChange={(event) => setGapSize(Number(event.target.value))}
          />
          <output>{gapSize}px</output>
        </label>
      </div>

      <div className="algorithm-stepper" aria-label="Algorithm phases">
        {pipeline.phases.map((phase, index) => (
          <button
            type="button"
            key={phase.id}
            aria-pressed={activePhase === index}
            onClick={() => setActivePhase(index)}
          >
            <span>{index + 1}</span>
            {phase.label}
          </button>
        ))}
      </div>

      <PipelineGraph pipeline={pipeline} activePhase={activePhase} />

      <div className="algorithm-step-actions">
        <button
          type="button"
          disabled={activePhase === 0}
          onClick={() => setActivePhase((phase) => Math.max(0, phase - 1))}
        >
          Previous phase
        </button>
        <div>
          <strong>Resolved geometry</strong>
          <span>{pipeline.finalGeometry.join(" · ")}</span>
        </div>
        <button
          type="button"
          disabled={activePhase === pipeline.phases.length - 1}
          onClick={() => setActivePhase((phase) => Math.min(pipeline.phases.length - 1, phase + 1))}
        >
          Next phase
        </button>
      </div>
    </section>
  );
}
