"use client";

import {useState} from "react";
import {createIncrementalLayoutCache, recomputeIncrementalLayout} from "@/lib/incremental-layout";
import {buildGridEngineTree} from "@/lib/layout-engine-fixtures";
import {buildBlockLayoutTree, buildFlexLayoutTree, flattenLayoutTree, updateLayoutNode, type LayoutNode} from "@/lib/layout-tree";
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
  apply?: (tree: LayoutNode) => LayoutNode;
};

const presets: Record<InvalidationScenario, readonly MutationPreset[]> = {
  block: [
    {
      id: "content-height",
      label: "Content height changes",
      summary: "Recompute the changed block, later sibling positions, and auto-height ancestors; earlier siblings stay reusable.",
      mutation: {kind: "style", nodeId: "content", field: "height"},
      apply: (tree) => updateLayoutNode(tree, "content", (node) => ({...node, style: {...node.style, height: 180}})),
    },
    {
      id: "content-width",
      label: "Content width changes",
      summary: "The current numeric block baseline has no text reflow, so width changes stay local to Content geometry.",
      mutation: {kind: "style", nodeId: "content", field: "width"},
      apply: (tree) => updateLayoutNode(tree, "content", (node) => ({...node, style: {...node.style, width: 300}})),
    },
    {
      id: "content-margin-after",
      label: "Content trailing margin changes",
      summary: "Invalidation begins at the following Footer position and propagates through the parent flow extent.",
      mutation: {kind: "style", nodeId: "content", field: "marginBlockAfter"},
      apply: (tree) => updateLayoutNode(tree, "content", (node) => ({...node, style: {...node.style, marginBlockAfter: 40}})),
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
      apply: (tree) => updateLayoutNode(tree, "item-b", (node) => ({
        ...node,
        style: {...node.style, flexItem: {...node.style.flexItem!, grow: 3}},
      })),
    },
    {
      id: "height",
      label: "Item B height changes",
      summary: "Cross-size invalidation bypasses main-axis Flex resolution and reaches only Item B plus the auto-height root.",
      mutation: {kind: "style", nodeId: "item-b", field: "height"},
      apply: (tree) => updateLayoutNode(tree, "item-b", (node) => ({...node, style: {...node.style, height: 104}})),
    },
    {
      id: "width-ignored",
      label: "Item B width changes",
      summary: "Width is deliberately ignored by the current Flex subset; flex-basis remains authoritative, so no layout phase is dirty.",
      mutation: {kind: "style", nodeId: "item-b", field: "width"},
      apply: (tree) => updateLayoutNode(tree, "item-b", (node) => ({...node, style: {...node.style, width: 999}})),
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
      apply: (tree) => updateLayoutNode(tree, "span-ab", (node) => ({
        ...node,
        style: {...node.style, gridItem: {...node.style.gridItem!, minContribution: 340}},
      })),
    },
    {
      id: "placement",
      label: "C placement changes",
      summary: "C has no sizing contribution, so changing its explicit column placement invalidates C geometry without rerunning track sizing.",
      mutation: {kind: "style", nodeId: "item-c", field: "gridItem.columnStart"},
      apply: (tree) => updateLayoutNode(tree, "item-c", (node) => ({
        ...node,
        style: {...node.style, gridItem: {...node.style.gridItem!, columnStart: 1}},
      })),
    },
    {
      id: "width-ignored",
      label: "C max-width changes",
      summary: "The current Grid subset derives item width from tracks and deliberately ignores item max-width, producing an empty dirty set.",
      mutation: {kind: "style", nodeId: "item-c", field: "maxWidth"},
      apply: (tree) => updateLayoutNode(tree, "item-c", (node) => ({...node, style: {...node.style, maxWidth: 20}})),
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

function geometrySignature(cache: ReturnType<typeof createIncrementalLayoutCache>) {
  return JSON.stringify(cache.boxes.map((box) => ({id: box.id, ...box.rect})));
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

  const nextTree = preset.apply?.(tree);
  const initialCache = nextTree ? createIncrementalLayoutCache(tree) : undefined;
  const incremental = nextTree && initialCache
    ? recomputeIncrementalLayout(initialCache, nextTree, preset.mutation)
    : undefined;
  const clean = nextTree ? createIncrementalLayoutCache(nextTree) : undefined;
  const matchesClean = incremental && clean
    ? geometrySignature(incremental.cache) === geometrySignature(clean)
    : undefined;
  const recomputed = new Set(incremental?.recomputedNodeIds ?? []);
  const treeNodes = flattenLayoutTree(tree);

  const selectScenario = (next: InvalidationScenario) => {
    setScenario(next);
    setPresetId(presets[next][0]!.id);
  };

  return (
    <section className="layout-invalidation" aria-labelledby="layout-invalidation-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H8 incremental relayout</div>
          <h3 id="layout-invalidation-title">Invalidation, reuse, and partial execution</h3>
        </div>
        <p>
          The dependency graph comes from the H5 typed tree. Supported style mutations now execute only their dirty phases against cached layout evidence, then compare the result with a clean full H5 recomputation.
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
        <p><strong>Planning work:</strong> {plan.work.phaseVisits} phase visits · {plan.work.edgeTraversals} dependency-edge traversals</p>
        <p><strong>Dependency graph rebuild:</strong> {plan.requiresGraphRebuild ? "required after structural mutation" : "not required"}</p>
      </div>

      {incremental ? (
        <div className="layout-invalidation-execution" aria-label="Incremental execution evidence">
          <div>
            <strong>{incremental.recomputedNodeIds.length}</strong>
            <span>recomputed nodes</span>
          </div>
          <div>
            <strong>{incremental.work.reusedNodes}</strong>
            <span>reused nodes</span>
          </div>
          <div>
            <strong>{incremental.work.visitedNodes}</strong>
            <span>visited nodes</span>
          </div>
          <div>
            <strong>{incremental.work.solverPasses}</strong>
            <span>solver passes</span>
          </div>
          <div>
            <strong>{incremental.work.boundaryNodeVisits} / {incremental.work.provenanceComparisons}</strong>
            <span>boundary visits / provenance comparisons</span>
          </div>
          <div>
            <strong>{incremental.work.graphRebuilds}</strong>
            <span>dependency graph rebuilds</span>
          </div>
          <div data-match={matchesClean ? "true" : "false"}>
            <strong>{matchesClean ? "identical" : "mismatch"}</strong>
            <span>incremental vs clean geometry</span>
          </div>
        </div>
      ) : (
        <div className="layout-invalidation-structural" role="note">
          <strong>Planner-only structural mutation</strong>
          <span>The graph must be rebuilt for the changed tree shape before cached incremental execution can continue.</span>
        </div>
      )}

      {incremental ? (
        <div className="layout-invalidation-node-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col">Execution</th>
                <th scope="col">Final geometry</th>
              </tr>
            </thead>
            <tbody>
              {treeNodes.map((node) => {
                const box = incremental.cache.boxes.find((candidate) => candidate.id === node.id)!;
                const isRecomputed = recomputed.has(node.id);
                return (
                  <tr key={node.id} data-recomputed={isRecomputed ? "true" : "false"}>
                    <th scope="row"><code>{node.id}</code> {node.label}</th>
                    <td>{isRecomputed ? "recomputed" : "reused from cache"}</td>
                    <td>x {box.rect.x} · y {box.rect.y} · {box.rect.width}×{box.rect.height}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

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
        Incremental style execution is verified against a clean full recomputation. Boundary visits and provenance comparisons report the work required before reuse is trusted; phase/edge traversal reports invalidation planning; executor visits and solver passes report recomputation. Structural insert/remove/reorder remains a fail-closed boundary until the dependency graph is rebuilt for the new tree shape.
      </p>
    </section>
  );
}
