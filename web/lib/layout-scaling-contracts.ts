import {
  createIncrementalLayoutCache,
  recomputeIncrementalLayout,
  type IncrementalLayoutCache,
  type IncrementalLayoutResult,
} from "./incremental-layout";
import {layoutBlockTree} from "./layout-engine";
import type {LayoutMutation} from "./layout-invalidation";
import {updateLayoutNode, type LayoutNode} from "./layout-tree";

/**
 * Operation-level work contracts for incremental layout.
 *
 * Each tree family keeps the mutated branch fixed (same depth, same ancestor
 * fan-out, same affected nodes) while the population of unrelated nodes grows.
 * Local and no-op mutations must report identical deterministic work at every
 * population, so an implementation that quietly falls back to full-tree
 * recomputation fails even when its output still matches clean layout.
 * Dependency-topology mutations and full clean layout are measured against
 * their own declared dimensions instead of the local budget.
 */

export type IncrementalLayoutExecutor = (
  cache: IncrementalLayoutCache,
  nextTree: LayoutNode,
  mutation: LayoutMutation,
) => IncrementalLayoutResult;

export type ScalingOperationId = "local-style" | "repeated-noop" | "dependency-topology" | "full-clean";

export type ScalingDimensions = {
  /** Every node in the tree, including the unrelated population. */
  totalNodes: number;
  /** Nodes of the unrelated subtrees that the mutation must not depend on. */
  unrelatedNodes: number;
  /** Root, affected branch and its children: the fixed dependency region. */
  affectedNodes: number;
  /** Depth of the mutated node below the root. */
  affectedDepth: number;
  /** Mutations that change the dependency-graph topology. */
  topologyTransitions: number;
  /** Children of the mutated node's ancestors that flow traversal may read. */
  ancestorFanOut: number;
  mutations: number;
};

export type ScalingCounters = {
  boundaryNodeVisits: number;
  provenanceComparisons: number;
  invalidationPhaseVisits: number;
  invalidationEdgeTraversals: number;
  graphRebuilds: number;
  executorVisits: number;
  recomputedNodes: number;
  solverPasses: number;
};

export type ScalingSample = {
  operation: ScalingOperationId;
  population: number;
  dimensions: ScalingDimensions;
  counters: ScalingCounters;
  /** Distinct node ids any step recomputed, sorted. */
  recomputedNodeIds: readonly string[];
  /** Steps (1-based) whose geometry differed from clean layout of that step's tree. */
  divergentSteps: readonly number[];
};

export type ScalingContractResult = {
  samples: readonly ScalingSample[];
  violations: readonly string[];
};

export const SCALING_POPULATIONS = [8, 64, 512] as const;
export const SCALING_OPERATIONS: readonly ScalingOperationId[] = [
  "local-style",
  "repeated-noop",
  "dependency-topology",
  "full-clean",
];

const AFFECTED_LEAVES = 4;
const ROOT_WIDTH = 960;
const UNRELATED_GROUPS = 3;
const LOCAL_MUTATIONS = 8;
const MUTATED_LEAF = "affected-leaf-1";
const TOPOLOGY_LEAF = "affected-leaf-2";

/**
 * Counters that local mutations must keep independent of the unrelated
 * population. Every counter of the engine's deterministic work evidence is
 * listed; none is exempt.
 */
export const LOCAL_BOUNDED_COUNTERS: readonly (keyof ScalingCounters)[] = [
  "boundaryNodeVisits",
  "provenanceComparisons",
  "invalidationPhaseVisits",
  "invalidationEdgeTraversals",
  "graphRebuilds",
  "executorVisits",
  "recomputedNodes",
  "solverPasses",
];

/** Counters a repeated identical mutation must keep at zero. */
export const NOOP_ZERO_COUNTERS: readonly (keyof ScalingCounters)[] = [
  "invalidationPhaseVisits",
  "invalidationEdgeTraversals",
  "graphRebuilds",
  "executorVisits",
  "recomputedNodes",
  "solverPasses",
];

function leaf(id: string): LayoutNode {
  return {
    id,
    label: id,
    style: {display: "block", width: 160, height: 20, marginBlockAfter: 4},
    children: [],
  };
}

/**
 * A block tree whose affected branch is fixed: the first root child holds
 * `AFFECTED_LEAVES` leaves under an explicit block size, so a leaf margin
 * change reflows only that group. The unrelated population sits in sibling
 * groups below the same root and grows with `population`.
 */
export function buildScalingTree(population: number): LayoutNode {
  if (!Number.isInteger(population) || population < 1) {
    throw new Error(`scaling population must be a positive integer: ${population}`);
  }
  return {
    id: "scaling-root",
    label: "Scaling root",
    style: {display: "block", width: ROOT_WIDTH},
    children: [
      {
        id: "affected-group",
        label: "Affected group",
        style: {display: "block", height: AFFECTED_LEAVES * 32, marginBlockAfter: 8},
        children: Array.from({length: AFFECTED_LEAVES}, (_, index) => leaf(`affected-leaf-${index}`)),
      },
      ...Array.from({length: UNRELATED_GROUPS}, (_, groupIndex): LayoutNode => ({
        id: `unrelated-group-${groupIndex}`,
        label: `Unrelated group ${groupIndex}`,
        style: {display: "block", marginBlockAfter: 8},
        children: Array.from({length: population}, (_, index) => leaf(`unrelated-${groupIndex}-${index}`)),
      })),
    ],
  };
}

/** Ids of the fixed dependency region: the root and the affected branch. */
export function affectedNodeIds(): readonly string[] {
  return [
    "scaling-root",
    "affected-group",
    ...Array.from({length: AFFECTED_LEAVES}, (_, index) => `affected-leaf-${index}`),
  ];
}

export function scalingDimensions(
  population: number,
  mutations: number,
  topologyTransitions = 0,
): ScalingDimensions {
  const unrelatedNodes = UNRELATED_GROUPS * (1 + population);
  const affectedNodes = 2 + AFFECTED_LEAVES;
  return {
    totalNodes: affectedNodes + unrelatedNodes,
    unrelatedNodes,
    affectedNodes,
    affectedDepth: 2,
    topologyTransitions,
    ancestorFanOut: 1 + UNRELATED_GROUPS + AFFECTED_LEAVES,
    mutations,
  };
}

function emptyCounters(): ScalingCounters {
  return {
    boundaryNodeVisits: 0,
    provenanceComparisons: 0,
    invalidationPhaseVisits: 0,
    invalidationEdgeTraversals: 0,
    graphRebuilds: 0,
    executorVisits: 0,
    recomputedNodes: 0,
    solverPasses: 0,
  };
}

function geometrySignature(boxes: IncrementalLayoutCache["boxes"]) {
  return JSON.stringify(boxes.map((box) => ({id: box.id, ...box.rect})));
}

type ScalingStep = {
  mutation: Extract<LayoutMutation, {kind: "style"}>;
  apply: (tree: LayoutNode) => LayoutNode;
  changesTopology?: boolean;
};

function setStyle(nodeId: string, style: Partial<LayoutNode["style"]>) {
  return (tree: LayoutNode) => updateLayoutNode(tree, nodeId, (node) => ({
    ...node,
    style: {...node.style, ...style},
  }));
}

function stepsFor(operation: Exclude<ScalingOperationId, "full-clean">): readonly ScalingStep[] {
  if (operation === "local-style") {
    return Array.from({length: LOCAL_MUTATIONS}, (_, index) => ({
      mutation: {kind: "style", nodeId: MUTATED_LEAF, field: "marginBlockBefore"},
      apply: setStyle(MUTATED_LEAF, {marginBlockBefore: index % 2 === 0 ? 6 : 2}),
    }));
  }
  if (operation === "repeated-noop") {
    // A fresh style object with the leaf's current (default) semantics.
    return Array.from({length: LOCAL_MUTATIONS}, () => ({
      mutation: {kind: "style", nodeId: MUTATED_LEAF, field: "marginBlockBefore"},
      apply: (tree) => updateLayoutNode(tree, MUTATED_LEAF, (node) => ({...node, style: {...node.style}})),
    }));
  }
  // Removing the leaf width adds its dependency on the containing inline size;
  // the root width change exercises that new dependency before it is removed
  // again, so a stale graph diverges from clean layout.
  return [
    {
      mutation: {kind: "style", nodeId: TOPOLOGY_LEAF, field: "width"},
      apply: setStyle(TOPOLOGY_LEAF, {width: undefined}),
      changesTopology: true,
    },
    {
      mutation: {kind: "style", nodeId: "scaling-root", field: "width"},
      apply: setStyle("scaling-root", {width: ROOT_WIDTH - 60}),
    },
    {
      mutation: {kind: "style", nodeId: TOPOLOGY_LEAF, field: "width"},
      apply: setStyle(TOPOLOGY_LEAF, {width: 160}),
      changesTopology: true,
    },
    {
      mutation: {kind: "style", nodeId: "scaling-root", field: "width"},
      apply: setStyle("scaling-root", {width: ROOT_WIDTH}),
    },
  ];
}

export function measureScalingOperation(
  operation: ScalingOperationId,
  population: number,
  executor: IncrementalLayoutExecutor = recomputeIncrementalLayout,
): ScalingSample {
  const initial = buildScalingTree(population);
  const counters = emptyCounters();

  if (operation === "full-clean") {
    const clean = layoutBlockTree(initial);
    counters.executorVisits = clean.visitedNodes;
    counters.recomputedNodes = clean.boxes.length;
    return {
      operation,
      population,
      dimensions: scalingDimensions(population, 0),
      counters,
      recomputedNodeIds: [],
      divergentSteps: [],
    };
  }

  const steps = stepsFor(operation);
  const recomputed = new Set<string>();
  const divergentSteps: number[] = [];
  let cache = createIncrementalLayoutCache(initial);
  steps.forEach((step, index) => {
    const result = executor(cache, step.apply(cache.tree), step.mutation);
    counters.boundaryNodeVisits += result.work.boundaryNodeVisits;
    counters.provenanceComparisons += result.work.provenanceComparisons;
    counters.invalidationPhaseVisits += result.work.invalidationPhaseVisits;
    counters.invalidationEdgeTraversals += result.work.invalidationEdgeTraversals;
    counters.graphRebuilds += result.work.graphRebuilds;
    counters.executorVisits += result.work.visitedNodes;
    counters.recomputedNodes += result.recomputedNodeIds.length;
    counters.solverPasses += result.work.solverPasses;
    result.recomputedNodeIds.forEach((id) => recomputed.add(id));
    cache = result.cache;
    if (geometrySignature(cache.boxes) !== geometrySignature(layoutBlockTree(cache.tree).boxes)) {
      divergentSteps.push(index + 1);
    }
  });

  return {
    operation,
    population,
    dimensions: scalingDimensions(
      population,
      steps.length,
      steps.filter((step) => step.changesTopology).length,
    ),
    counters,
    recomputedNodeIds: [...recomputed].sort(),
    divergentSteps,
  };
}

function sampleLabel(sample: ScalingSample) {
  return `${sample.operation} at ${sample.dimensions.totalNodes} nodes`;
}

/**
 * Checks samples of one or more operations measured at several populations.
 * Returns human-readable violations; an empty list means the contract holds.
 */
export function evaluateScalingContract(samples: readonly ScalingSample[]): string[] {
  const violations: string[] = [];
  const byOperation = new Map<ScalingOperationId, ScalingSample[]>();
  samples.forEach((sample) => {
    byOperation.set(sample.operation, [...(byOperation.get(sample.operation) ?? []), sample]);
    if (sample.divergentSteps.length > 0) {
      violations.push(
        `${sampleLabel(sample)}: geometry differs from clean layout after step(s) ${sample.divergentSteps.join(", ")}`,
      );
    }
  });

  const requirePopulationIndependence = (operation: ScalingOperationId, counters: readonly (keyof ScalingCounters)[]) => {
    const group = byOperation.get(operation) ?? [];
    const reference = group[0];
    if (!reference) return;
    if (new Set(group.map((sample) => sample.dimensions.unrelatedNodes)).size < 2) {
      violations.push(`${operation}: needs at least two unrelated populations to show independence`);
      return;
    }
    group.slice(1).forEach((sample) => {
      counters.forEach((counter) => {
        if (sample.counters[counter] !== reference.counters[counter]) {
          violations.push(
            `${operation}: ${counter} depends on unrelated nodes `
            + `(${reference.counters[counter]} at ${reference.dimensions.totalNodes} nodes, `
            + `${sample.counters[counter]} at ${sample.dimensions.totalNodes} nodes)`,
          );
        }
      });
    });
  };

  const affected = new Set(affectedNodeIds());
  requirePopulationIndependence("local-style", LOCAL_BOUNDED_COUNTERS);
  requirePopulationIndependence("repeated-noop", LOCAL_BOUNDED_COUNTERS);

  (byOperation.get("local-style") ?? []).forEach((sample) => {
    if (sample.counters.graphRebuilds !== 0) {
      violations.push(`${sampleLabel(sample)}: local style mutation rebuilt the dependency graph`);
    }
    const outside = sample.recomputedNodeIds.filter((id) => !affected.has(id));
    if (outside.length > 0) {
      violations.push(`${sampleLabel(sample)}: recomputed nodes outside the affected region: ${outside.join(", ")}`);
    }
  });
  (byOperation.get("repeated-noop") ?? []).forEach((sample) => {
    NOOP_ZERO_COUNTERS.forEach((counter) => {
      if (sample.counters[counter] !== 0) {
        violations.push(`${sampleLabel(sample)}: no-op mutation reported ${sample.counters[counter]} ${counter}`);
      }
    });
  });
  // A dependency-topology change legitimately rebuilds the graph, which is
  // linear in the dependency graph: exactly once per topology transition, and
  // never for the trace's ordinary mutations.
  (byOperation.get("dependency-topology") ?? []).forEach((sample) => {
    if (sample.counters.graphRebuilds !== sample.dimensions.topologyTransitions) {
      violations.push(
        `${sampleLabel(sample)}: ${sample.counters.graphRebuilds} graph rebuilds for `
        + `${sample.dimensions.topologyTransitions} topology transitions`,
      );
    }
  });
  // Full clean layout is the O(N) correctness reference; its visits are the
  // clean executor's own measured work.
  (byOperation.get("full-clean") ?? []).forEach((sample) => {
    if (sample.counters.executorVisits !== sample.dimensions.totalNodes) {
      violations.push(`${sampleLabel(sample)}: clean layout did not visit every node exactly once`);
    }
  });
  return violations;
}

export function runScalingContract(
  executor: IncrementalLayoutExecutor = recomputeIncrementalLayout,
  populations: readonly number[] = SCALING_POPULATIONS,
  operations: readonly ScalingOperationId[] = SCALING_OPERATIONS,
): ScalingContractResult {
  const samples = operations.flatMap((operation) =>
    populations.map((population) => measureScalingOperation(operation, population, executor)));
  return {samples, violations: evaluateScalingContract(samples)};
}
