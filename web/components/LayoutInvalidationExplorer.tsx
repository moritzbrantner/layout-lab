"use client";

import {useState} from "react";
import {buildGridEngineTree} from "@/lib/layout-engine-fixtures";
import {buildBlockLayoutTree, buildFlexLayoutTree, type LayoutNode} from "@/lib/layout-tree";
import {
  buildLayoutInvalidationGraph,
  planLayoutInvalidation,
  type LayoutMutation,
} from "@/lib/layout-invalidation";

type InvalidationScenario = "block" | "flex" | "grid";

type MutationPreset = {
  id: string;
  label: string;
  summary: string;
  mutation: LayoutMutation;
};

const presets: Record<InvalidationScenario, readonly MutationPreset[]> = {
  block: [
    {
      id: "content-height",
      label: "Content height changes",
      summary: "Recompute the changed block, later sibling positions, and auto-height ancestors; earlier siblings stay reusable.",
      mutation: {kind: "style", nodeId: "content", field: "height"},
    },
    {
      id: "content-width",
      label: "Content width changes",
      summary: "The current numeric block baseline has no text reflow, so width changes stay local to Content geometry.",
      mutation: {kind: "style", nodeId: "content", field: "width"},
    },
    {
      id: "content-margin-after",
      label: "Content trailing margin changes",
      summary: "Invalidation begins at the following Footer position and propagates through the parent flow extent.",
      mutation: {kind: "style", nodeId: "content", field: "marginBlockAfter"},
    },
    {
      id: "reorder",
      label: "Children reorder",
      summary: "A structural change dirties the ordered flow positions and requires rebuilding dependency edges for the new child order.",
      mutation: {kind: "children", parentId: "block-root", operation: "reorder"},
    },
  ],
  flex: [
    {
      id: "grow",
      label: "Item B flex-grow changes",
      summary: "The Flex line is the dependency boundary: all item main sizes and positions may change, but cross sizes remain reusable.",
      mutation: {kind: "style", nodeId: "item-b", field: "flexItem.grow"},
    },
    {
      id: "height",
      label: "Item B height changes",
      summary: "Cross-size invalidation bypasses main-axis Flex resolution and reaches only Item B plus the auto-height root.",
      mutation: {kind: "style", nodeId: "item-b", field: "height"},
    },
    {
      id: "width-ignored",
      label: "Item B width changes",
      summary: "Width is deliberately ignored by the current Flex subset; flex-basis remains authoritative, so no layout phase is dirty.",
      mutation: {kind: "style", nodeId: "item-b", field: "width"},
    },
    {
      id: "insert",
      label: "Insert a Flex item",
      summary: "The line and auto cross-size must be recomputed, and the dependency graph must be rebuilt to include the new node.",
      mutation: {kind: "children", parentId: "root", operation: "insert"},
    },
  ],
  grid: [
    {
      id: "contribution",
      label: "Spanning contribution changes",
      summary: "The changed contribution feeds Grid track sizing, so every item using those resolved tracks becomes dirty.",
      mutation: {kind: "style", nodeId: "span-ab", field: "gridItem.minContribution"},
    },
    {
      id: "placement",
      label: "C placement changes",
      summary: "C has no sizing contribution, so changing its explicit column placement invalidates C geometry without rerunning track sizing.",
      mutation: {kind: "style", nodeId: "item-c", field: "gridItem.columnStart"},
    },
    {
      id: "width-ignored",
      label: "C max-width changes",
      summary: "The current Grid subset derives item width from tracks and deliberately ignores item max-width, producing an empty dirty set.",
      mutation: {kind: "style", nodeId: "item-c", field: "maxWidth"},
    },
    {
      id: "reorder",
      label: "Grid children reorder",
      summary: "Structural changes require rebuilding the graph; track sizing is conservatively dirtied because contribution order belongs to the current resolver input.",
      mutation: {kind: "children", parentId: "root", operation: "reorder"},
    },
  ],
};

function buildTree(scenario: InvalidationScenario): LayoutNode {
  if (scenario === "block") return buildBlockLayoutTree();
  if (scenario === "flex") return buildFlexLayoutTree();
  return buildGridEngineTree();
}

function mutationText(mutation: LayoutMutation) {
  return mutation.kind === "style"
    ? `${mutation.nodeId}.${mutation.field}`
    : `${mutation.operation} children of ${mutation.parentId}`;
}

export function LayoutInvalidationExplorer() {
  const [scenario, setScenario] = useState<InvalidationScenario>("block");
  const [presetId, setPresetId] = useState(presets.block[0]!.id);
  const scenarioPresets = presets[scenario];
  const preset = scenarioPresets.find((candidate) => candidate.id === presetId) ?? scenarioPresets[0]!;
  const tree = buildTree(scenario);
  const graph = buildLayoutInvalidationGraph(tree);
  const plan = planLayoutInvalidation(graph, preset.mutation);
  const dirty = new Set(plan.dirtyPhaseIds);
  const incomingByPhase = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    if (!dirty.has(edge.from) || !dirty.has(edge.to)) return;
    const reasons = incomingByPhase.get(edge.to) ?? [];
    reasons.push(edge.reason);
    incomingByPhase.set(edge.to, reasons);
  });

  const selectScenario = (next: InvalidationScenario) => {
    setScenario(next);
    setPresetId(presets[next][0]!.id);
  };

  return (
    <section className="layout-invalidation" aria-labelledby="layout-invalidation-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H8 invalidation foundation</div>
          <h3 id="layout-invalidation-title">Typed dependency graph and dirty-set planner</h3>
        </div>
        <p>
          The graph is derived from the H5 typed layout tree and models only dependencies the current deterministic engine actually reads. Mutations start at the narrowest affected phase and propagate downstream.
        </p>
      </div>

      <div className="layout-invalidation-controls">
        <label>
          <span>formatting context</span>
          <select value={scenario} onChange={(event) => selectScenario(event.target.value as InvalidationScenario)}>
            <option value="block">Block flow</option>
            <option value="flex">Flex row</option>
            <option value="grid">Grid row</option>
          </select>
        </label>
        <label>
          <span>mutation</span>
          <select value={preset.id} onChange={(event) => setPresetId(event.target.value)}>
            {scenarioPresets.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>
        <div>
          <strong>{mutationText(preset.mutation)}</strong>
          <span>{preset.summary}</span>
        </div>
      </div>

      <div className="layout-invalidation-evidence">
        <p><strong>Seed phases:</strong> {plan.seedPhaseIds.length > 0 ? plan.seedPhaseIds.join(" · ") : "none — current subset does not consume this property"}</p>
        <p><strong>Planned dirty phases:</strong> {plan.dirtyPhaseIds.length} of {graph.nodes.length}</p>
        <p><strong>Dependency graph rebuild:</strong> {plan.requiresGraphRebuild ? "required after structural mutation" : "not required"}</p>
      </div>

      <div className="layout-invalidation-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Layout node</th>
              <th scope="col">Phase</th>
              <th scope="col">Plan</th>
              <th scope="col">Dirty dependency</th>
            </tr>
          </thead>
          <tbody>
            {graph.nodes.map((node) => {
              const isDirty = dirty.has(node.id);
              const reasons = incomingByPhase.get(node.id) ?? [];
              return (
                <tr key={node.id} data-dirty={isDirty ? "true" : "false"}>
                  <th scope="row"><code>{node.layoutNodeId}</code></th>
                  <td>{node.phase}</td>
                  <td>{isDirty ? "dirty" : "reusable"}</td>
                  <td>{plan.seedPhaseIds.includes(node.id)
                    ? "mutation seed"
                    : reasons.length > 0
                      ? reasons.join("; ")
                      : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="layout-invalidation-boundary">
        This slice plans invalidation only. It does not yet claim incremental execution or reuse of cached geometry; H8 recomputation will consume this dirty set in the next slice.
      </p>
    </section>
  );
}
