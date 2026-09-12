"use client";

import {useState} from "react";
import {
  algorithmDefinitions,
  getAlgorithmDefinition,
  runAlgorithm,
  type AlgorithmZooId,
} from "@/lib/algorithm-zoo";

function formatNumber(value: number) {
  return Math.round(value * 100) / 100;
}

export function AlgorithmZooExplorer() {
  const [algorithmId, setAlgorithmId] = useState<AlgorithmZooId>("block-flow");
  const definition = getAlgorithmDefinition(algorithmId);
  const execution = runAlgorithm(algorithmId);

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
          <select value={algorithmId} onChange={(event) => setAlgorithmId(event.target.value as AlgorithmZooId)}>
            {algorithmDefinitions.map((algorithm) => (
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

        <div className="algorithm-zoo-trace">
          <h4>Common trace output</h4>
          {execution.trace.length > 0 ? (
            <ol>
              {execution.trace.map((step) => (
                <li key={step.id}>
                  <strong>{step.label}</strong>
                  <span>{step.summary}</span>
                </li>
              ))}
            </ol>
          ) : <p>No intermediate trace steps for this fixture.</p>}
        </div>
      </div>

      {execution.diagnostics.length > 0 ? (
        <div className="algorithm-zoo-diagnostics" aria-label="Algorithm diagnostics">
          <strong>Diagnostics</strong>
          <ul>
            {execution.diagnostics.map((diagnostic) => <li key={diagnostic}>{diagnostic}</li>)}
          </ul>
        </div>
      ) : null}

      <p className="algorithm-zoo-boundary">
        Constraint solving now uses this shared result contract. Planned line-breaking, packing, tree, DAG, and force-directed algorithms will plug into the same surface rather than adding one-off visualization models.
      </p>
    </section>
  );
}
