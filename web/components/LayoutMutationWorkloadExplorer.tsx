"use client";

import {useState} from "react";
import {
  mutationWorkloadDefinitions,
  runMutationWorkload,
  type MutationWorkloadId,
} from "@/lib/layout-mutation-workloads";

function nodeList(ids: readonly string[]) {
  return ids.length > 0 ? ids.join(", ") : "—";
}

export function LayoutMutationWorkloadExplorer() {
  const [workloadId, setWorkloadId] = useState<MutationWorkloadId>("block-structure");
  const result = runMutationWorkload(workloadId);

  return (
    <section className="layout-workload" aria-labelledby="layout-workload-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H8 deterministic workloads</div>
          <h3 id="layout-workload-title">Mutation traces and relayout work</h3>
        </div>
        <p>
          Replayable mutation traces measure structural graph rebuilds, nodes actually visited by the executor, and solver work. No wall-clock timing is used for these claims.
        </p>
      </div>

      <div className="layout-workload-selector">
        <label>
          <span>workload</span>
          <select value={workloadId} onChange={(event) => setWorkloadId(event.target.value as MutationWorkloadId)}>
            {mutationWorkloadDefinitions.map((definition) => (
              <option key={definition.id} value={definition.id}>{definition.title}</option>
            ))}
          </select>
        </label>
        <div>
          <strong>{result.definition.title}</strong>
          <span>{result.definition.summary}</span>
        </div>
      </div>

      <div className="layout-workload-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Class</th>
              <th scope="col">Execution</th>
              <th scope="col">Dirty phases</th>
              <th scope="col">Recomputed nodes</th>
              <th scope="col">Reused nodes</th>
              <th scope="col">Visited / clean</th>
              <th scope="col">Solver work / clean</th>
              <th scope="col">Graph rebuild</th>
              <th scope="col">Geometry</th>
            </tr>
          </thead>
          <tbody>
            {result.steps.map((step) => (
              <tr key={step.id} data-match={step.geometryMatchesClean ? "true" : "false"}>
                <th scope="row">{step.label}</th>
                <td>{step.category}</td>
                <td>{step.mode}</td>
                <td>{step.dirtyPhaseCount}</td>
                <td>{nodeList(step.recomputedNodeIds)}</td>
                <td>{nodeList(step.reusedNodeIds)}</td>
                <td>{step.visitedNodes} / {step.cleanVisitedNodes}</td>
                <td>{step.algorithmIterations} / {step.cleanAlgorithmIterations}</td>
                <td>{step.graphRebuilds === 1 ? "yes" : "no"}</td>
                <td>{step.geometryMatchesClean ? "identical" : "mismatch"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Trace total</th>
              <td colSpan={5}>deterministic aggregate</td>
              <td>{result.totalVisitedNodes} / {result.totalCleanVisitedNodes}</td>
              <td>{result.totalAlgorithmIterations} / {result.totalCleanAlgorithmIterations}</td>
              <td>{result.totalGraphRebuilds}</td>
              <td>{result.steps.every((step) => step.geometryMatchesClean) ? "all identical" : "mismatch"}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="layout-workload-boundary">
        Flex work reports real line-resolution iterations. Grid work reports one track-resolution pass per resolver invocation; finer internal Grid pass instrumentation is reserved for H10 rather than approximated here.
      </p>
    </section>
  );
}
