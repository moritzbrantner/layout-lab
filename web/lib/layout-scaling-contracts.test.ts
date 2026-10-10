import {describe, expect, test} from "bun:test";
import {createIncrementalLayoutCache, recomputeIncrementalLayout} from "./incremental-layout";
import {planLayoutInvalidation, buildLayoutInvalidationGraph} from "./layout-invalidation";
import {
  buildScalingTree,
  measureScalingOperation,
  runScalingContract,
  scalingDimensions,
  type IncrementalLayoutExecutor,
} from "./layout-scaling-contracts";
import {flattenLayoutTree} from "./layout-tree";

/** Output-correct but non-incremental: recomputes the whole tree each time. */
const cleanFallbackExecutor: IncrementalLayoutExecutor = (_cache, nextTree, mutation) => {
  const cache = createIncrementalLayoutCache(nextTree);
  const plan = planLayoutInvalidation(buildLayoutInvalidationGraph(nextTree), mutation);
  const nodeIds = flattenLayoutTree(nextTree).map((node) => node.id);
  return {
    cache,
    plan,
    recomputedNodeIds: nodeIds,
    reusedNodeIds: [],
    work: {
      recomputedPhaseCount: plan.dirtyPhaseIds.length,
      reusedPhaseCount: 0,
      visitedNodes: cache.boxes.length,
      reusedNodes: 0,
      solverPasses: 0,
      boundaryNodeVisits: 0,
      provenanceComparisons: 0,
      invalidationPhaseVisits: plan.work.phaseVisits,
      invalidationEdgeTraversals: plan.work.edgeTraversals,
      graphRebuilds: 0,
    },
  };
};

describe("operation-level layout scaling contracts", () => {
  test("tree families keep the affected branch fixed while unrelated nodes grow", () => {
    const small = scalingDimensions(8, 1);
    const large = scalingDimensions(512, 1);
    expect(flattenLayoutTree(buildScalingTree(8))).toHaveLength(small.totalNodes);
    expect(flattenLayoutTree(buildScalingTree(512))).toHaveLength(large.totalNodes);
    expect(large.unrelatedNodes).toBeGreaterThan(small.unrelatedNodes * 50);
    expect({...large, totalNodes: 0, unrelatedNodes: 0}).toEqual({...small, totalNodes: 0, unrelatedNodes: 0});
  });

  test("the incremental engine satisfies every operation contract", () => {
    const result = runScalingContract();
    expect(result.violations).toEqual([]);
    expect(result.samples.every((sample) => sample.geometryMatchesClean)).toBe(true);
  });

  test("local mutations report identical work regardless of unrelated population", () => {
    const small = measureScalingOperation("local-style", 8);
    const large = measureScalingOperation("local-style", 512);
    expect(large.counters).toEqual(small.counters);
    expect(large.counters.graphRebuilds).toBe(0);
    expect(large.counters.executorVisits).toBeLessThan(large.dimensions.totalNodes);
  });

  test("repeated identical mutations recompute nothing and keep the graph", () => {
    const sample = measureScalingOperation("repeated-noop", 512);
    expect(sample.counters).toMatchObject({
      invalidationPhaseVisits: 0,
      invalidationEdgeTraversals: 0,
      graphRebuilds: 0,
      executorVisits: 0,
      recomputedNodes: 0,
    });
    expect(sample.geometryMatchesClean).toBe(true);
  });

  test("topology mutations may rebuild the graph once per mutation without a local budget", () => {
    const sample = measureScalingOperation("dependency-topology", 512);
    expect(sample.counters.graphRebuilds).toBe(sample.dimensions.mutations);
    expect(sample.geometryMatchesClean).toBe(true);
  });

  test("full clean layout is the linear correctness reference", () => {
    const sample = measureScalingOperation("full-clean", 64);
    expect(sample.counters.executorVisits).toBe(sample.dimensions.totalNodes);
  });

  test("a clean-layout fallback for local mutations fails despite exact output", () => {
    const result = runScalingContract(cleanFallbackExecutor, [8, 64], ["local-style", "repeated-noop"]);
    expect(result.samples.every((sample) => sample.geometryMatchesClean)).toBe(true);
    expect(result.violations).toContain(
      "local-style: executorVisits depends on unrelated nodes (264 at 33 nodes, 1608 at 201 nodes)",
    );
    expect(result.violations).toContain(
      "local-style: recomputedNodes depends on unrelated nodes (264 at 33 nodes, 1608 at 201 nodes)",
    );
    expect(result.violations.some((violation) => violation.startsWith("repeated-noop at"))).toBe(true);
  });

  test("a single population cannot prove independence", () => {
    expect(runScalingContract(recomputeIncrementalLayout, [64], ["local-style"]).violations).toEqual([
      "local-style: needs at least two unrelated populations to show independence",
    ]);
  });
});
