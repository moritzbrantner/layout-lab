"use client";

import {useState} from "react";
import {
  algorithmComparisonDefinitions,
  algorithmComparisonTitles,
  runAlgorithmComparison,
  type AlgorithmComparisonId,
} from "@/lib/algorithm-comparison";

function formatNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function formatGeometry(value: {x: number; y: number; width: number; height: number} | null) {
  if (!value) return "missing";
  return `x ${formatNumber(value.x)} · y ${formatNumber(value.y)} · ${formatNumber(value.width)}×${formatNumber(value.height)}`;
}

export function AlgorithmComparisonExplorer() {
  const [comparisonId, setComparisonId] = useState<AlgorithmComparisonId>("line-breaking");
  const comparison = runAlgorithmComparison(comparisonId);
  const [firstTitle, secondTitle] = algorithmComparisonTitles(comparisonId);
  const [firstExecution, secondExecution] = comparison.executions;

  return (
    <section className="algorithm-comparison" aria-labelledby="algorithm-comparison-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H7 same-fixture comparison</div>
          <h3 id="algorithm-comparison-title">Side-by-side algorithms</h3>
        </div>
        <p>
          Comparisons only appear when both algorithms consume byte-for-byte equivalent serialized fixture input. Differences below therefore come from the algorithms, not different test data.
        </p>
      </div>

      <div className="algorithm-comparison-selector">
        <label>
          <span>comparison</span>
          <select value={comparisonId} onChange={(event) => setComparisonId(event.target.value as AlgorithmComparisonId)}>
            {algorithmComparisonDefinitions.map((definition) => (
              <option key={definition.id} value={definition.id}>{definition.title}</option>
            ))}
          </select>
        </label>
        <div>
          <strong>{comparison.definition.title}</strong>
          <span>{comparison.definition.summary}</span>
        </div>
        <div>
          <strong>shared fixture</strong>
          <span>{comparison.inputKind} · {comparison.fixtureId} · exact input match</span>
        </div>
      </div>

      <div className="algorithm-comparison-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">{firstTitle}</th>
              <th scope="col">{secondTitle}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{comparison.definition.primaryMeasure.label}</th>
              <td>{formatNumber(comparison.primaryValues[0])}{comparison.definition.primaryMeasure.unit}</td>
              <td>{formatNumber(comparison.primaryValues[1])}{comparison.definition.primaryMeasure.unit}</td>
            </tr>
            <tr>
              <th scope="row">trace steps</th>
              <td>{firstExecution.trace.length}</td>
              <td>{secondExecution.trace.length}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="algorithm-comparison-work">
        {[firstExecution, secondExecution].map((execution, index) => (
          <section key={execution.algorithmId} aria-label={`${index === 0 ? firstTitle : secondTitle} work evidence`}>
            <h4>{index === 0 ? firstTitle : secondTitle}</h4>
            <dl>
              {execution.work.map((counter) => (
                <div key={counter.key}>
                  <dt>{counter.label}</dt>
                  <dd>{formatNumber(counter.value)}{counter.unit ?? ""}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="algorithm-comparison-geometry">
        <h4>Geometry from the same fixture</h4>
        <div className="algorithm-comparison-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">{firstTitle}</th>
                <th scope="col">{secondTitle}</th>
              </tr>
            </thead>
            <tbody>
              {comparison.geometryRows.map((row) => (
                <tr key={row.id}>
                  <th scope="row"><code>{row.id}</code></th>
                  <td>{formatGeometry(row.values[0] ?? null)}</td>
                  <td>{formatGeometry(row.values[1] ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
