"use client";

import {useState} from "react";
import {AlgorithmComparisonExplorer} from "@/components/AlgorithmComparisonExplorer";
import {AlgorithmTraceStepper} from "@/components/AlgorithmTraceStepper";
import {LayoutInvalidationExplorer} from "@/components/LayoutInvalidationExplorer";
import {
  algorithmRegistryDefinitions,
  getAlgorithmRegistryDefinition,
  runRegistryAlgorithm,
  type AlgorithmRegistryId,
} from "@/lib/algorithm-zoo-registry";

function formatNumber(value: number) {
  return Math.round(value * 100) / 100;
}

export function AlgorithmZooExplorer() {
  const [algorithmId, setAlgorithmId] = useState<AlgorithmRegistryId>("block-flow");
  const [activeStep, setActiveStep] = useState(0);
  const definition = getAlgorithmRegistryDefinition(algorithmId);
  const execution = runRegistryAlgorithm(algorithmId);

  const selectAlgorithm = (nextId: AlgorithmRegistryId) => {
    setAlgorithmId(nextId);
    setActiveStep(0);
  };

  return (
    <section className="algorithm-zoo" aria-labelledby="algorithm-zoo-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H7 common contract</div>
          <h3 id="algorithm-zoo-title">Algorithm zoo</h3>
        </div>
        <p>
          Different layout algorithms now share one execution envelope: typed input, geometry output, inspectable trace steps, deterministic work counters, and diagnostics.
        </p>
      </div>

      <div className="algorithm-zoo-selector">
        <label>
          <span>algorithm</span>
          <select value={algorithmId} onChange={(event) => selectAlgorithm(event.target.value as AlgorithmRegistryId)}>
            {algorithmRegistryDefinitions.map((algorithm) => (
              <option key={algorithm.id} value={algorithm.id}>{algorithm.title}</option>
            ))}
          </select>
        </label>
        <div>
          <strong>{definition.title}</strong>
          <span>{definition.summary}</span>
        </div>
        <div>
          <strong>input</strong>
          <span>{execution.input.kind} · {execution.input.fixtureId}</span>
        </div>
      </div>

      <div className="algorithm-zoo-work" aria-label="Deterministic work evidence">
        {execution.work.map((counter) => (
          <span key={counter.key}>
            <strong>{formatNumber(counter.value)}{counter.unit ?? ""}</strong> {counter.label}
          </span>
        ))}
      </div>

      <div className="algorithm-zoo-output">
        <div className="algorithm-zoo-geometry">
          <h4>Common geometry output</h4>
          <div className="algorithm-zoo-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Node</th>
                  <th scope="col">X</th>
                  <th scope="col">Y</th>
                  <th scope="col">Width</th>
                  <th scope="col">Height</th>
                </tr>
              </thead>
              <tbody>
                {execution.geometry.map((geometry) => (
                  <tr key={geometry.id}>
                    <th scope="row"><code>{geometry.id}</code></th>
                    <td>{formatNumber(geometry.x)}</td>
                    <td>{formatNumber(geometry.y)}</td>
                    <td>{formatNumber(geometry.width)}</td>
                    <td>{formatNumber(geometry.height)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <AlgorithmTraceStepper
          trace={execution.trace}
          activeStep={activeStep}
          onStepChange={setActiveStep}
        />
      </div>

      {execution.diagnostics.length > 0 ? (
        <div className="algorithm-zoo-diagnostics" aria-label="Algorithm diagnostics">
          <strong>Diagnostics</strong>
          <ul>
            {execution.diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}
          </ul>
        </div>
      ) : null}

      <AlgorithmComparisonExplorer />

      <p className="algorithm-zoo-boundary">
        H7 now has one execution contract, one shared step-through surface, and explicit same-fixture comparisons where multiple algorithms solve identical input.
      </p>

      <LayoutInvalidationExplorer />
    </section>
  );
}
