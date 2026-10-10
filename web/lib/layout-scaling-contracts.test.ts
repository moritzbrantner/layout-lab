import {describe, expect, test} from "bun:test";
import {createIncrementalLayoutCache, recomputeIncrementalLayout} from "./incremental-layout";
import {planLayoutInvalidation, buildLayoutInvalidationGraph} from "./layout-invalidation";
import {
  buildScalingTree,
  LOCAL_BOUNDED_COUNTERS,
  measureScalingOperation,
  NOOP_ZERO_COUNTERS,
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
      // A clean rebuild writes every retained box and reports every node.
      retainedEntryWrites: cache.boxes.length,
      reportingNodeVisits: nodeIds.length,
    },
  };
};

/** Real incremental work, but reports copying every retained box per step. */
const fullRetainedCopyExecutor: IncrementalLayoutExecutor = (cache, nextTree, mutation) => {
  const result = recomputeIncrementalLayout(cache, nextTree, mutation);
  return {...result, work: {...result.work, retainedEntryWrites: result.cache.boxes.length}};
};

/** Real incremental work, but reports scanning every node id for reuse reporting. */
const fullReportingScanExecutor: IncrementalLayoutExecutor = (cache, nextTree, mutation) => {
  const result = recomputeIncrementalLayout(cache, nextTree, mutation);
  return {...result, work: {...result.work, reportingNodeVisits: flattenLayoutTree(nextTree).length}};
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
    expect(result.samples.every((sample) => sample.divergentSteps.length === 0)).toBe(true);
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
      retainedEntryWrites: 0,
      reportingNodeVisits: 0,
    });
    expect(sample.divergentSteps).toEqual([]);
  });

  test("topology mutations may rebuild the graph once per mutation without a local budget", () => {
    const sample = measureScalingOperation("dependency-topology", 512);
    expect(sample.dimensions.topologyTransitions).toBe(2);
    expect(sample.counters.graphRebuilds).toBe(2);
    expect(sample.divergentSteps).toEqual([]);
  });

  test("full clean layout is the linear correctness reference", () => {
    const sample = measureScalingOperation("full-clean", 64);
    expect(sample.counters.executorVisits).toBe(sample.dimensions.totalNodes);
  });

  test("a clean-layout fallback for local mutations fails despite exact output", () => {
    const result = runScalingContract(cleanFallbackExecutor, [8, 64], ["local-style", "repeated-noop"]);
    expect(result.samples.every((sample) => sample.divergentSteps.length === 0)).toBe(true);
    expect(result.violations).toContain(
      "local-style: executorVisits depends on unrelated nodes (264 at 33 nodes, 1608 at 201 nodes)",
    );
    expect(result.violations).toContain(
      "local-style: recomputedNodes depends on unrelated nodes (264 at 33 nodes, 1608 at 201 nodes)",
    );
    expect(result.violations.some((violation) => violation.startsWith("repeated-noop at"))).toBe(true);
  });

  test("retained-entry writes and reuse reporting are gated counters", () => {
    expect(LOCAL_BOUNDED_COUNTERS).toContain("retainedEntryWrites");
    expect(LOCAL_BOUNDED_COUNTERS).toContain("reportingNodeVisits");
    expect(NOOP_ZERO_COUNTERS).toContain("retainedEntryWrites");
    expect(NOOP_ZERO_COUNTERS).toContain("reportingNodeVisits");
  });

  test("local mutations keep retained-entry writes and reporting visits independent of population", () => {
    const small = measureScalingOperation("local-style", 8);
    const medium = measureScalingOperation("local-style", 64);
    const large = measureScalingOperation("local-style", 512);
    for (const sample of [medium, large]) {
      expect(sample.counters.retainedEntryWrites).toBe(small.counters.retainedEntryWrites);
      expect(sample.counters.reportingNodeVisits).toBe(small.counters.reportingNodeVisits);
    }
    // Bounded by the affected region, so far below one full copy/scan per step.
    expect(large.counters.retainedEntryWrites).toBeLessThan(large.dimensions.totalNodes);
    expect(large.counters.reportingNodeVisits).toBeLessThan(large.dimensions.totalNodes);
  });

  test("an executor that copies every retained box fails the local contract", () => {
    const result = runScalingContract(fullRetainedCopyExecutor, [8, 64], ["local-style", "repeated-noop"]);
    expect(result.samples.every((sample) => sample.divergentSteps.length === 0)).toBe(true);
    expect(result.violations).toContain(
      "local-style: retainedEntryWrites depends on unrelated nodes (264 at 33 nodes, 1608 at 201 nodes)",
    );
    expect(result.violations).toContain("repeated-noop at 33 nodes: no-op mutation reported 264 retainedEntryWrites");
    expect(result.violations.every((violation) => violation.includes("retainedEntryWrites"))).toBe(true);
  });

  test("an executor that scans every node id for reuse reporting fails the local contract", () => {
    const result = runScalingContract(fullReportingScanExecutor, [8, 64], ["local-style", "repeated-noop"]);
    expect(result.samples.every((sample) => sample.divergentSteps.length === 0)).toBe(true);
    expect(result.violations).toContain(
      "local-style: reportingNodeVisits depends on unrelated nodes (264 at 33 nodes, 1608 at 201 nodes)",
    );
    expect(result.violations).toContain("repeated-noop at 33 nodes: no-op mutation reported 264 reportingNodeVisits");
    expect(result.violations.every((violation) => violation.includes("reportingNodeVisits"))).toBe(true);
  });

  test("an executor without retained-work evidence cannot be measured", () => {
    const silent: IncrementalLayoutExecutor = (cache, nextTree, mutation) => {
      const result = recomputeIncrementalLayout(cache, nextTree, mutation);
      const {retainedEntryWrites: _dropped, ...work} = result.work;
      return {...result, work: work as typeof result.work};
    };
    expect(() => measureScalingOperation("local-style", 8, silent)).toThrow("missing retainedEntryWrites");
  });

  test("a reversible trace cannot hide a diverging intermediate step", () => {
    const frozen: IncrementalLayoutExecutor = (cache, nextTree, mutation) => {
      const result = recomputeIncrementalLayout(cache, nextTree, mutation);
      return {...result, cache: {...cache, tree: nextTree}};
    };
    const sample = measureScalingOperation("dependency-topology", 8, frozen);
    expect(sample.divergentSteps).toEqual([1, 2, 3]);
  });

  test("recomputing an unrelated node fails even with population-independent counts", () => {
    const leaky: IncrementalLayoutExecutor = (cache, nextTree, mutation) => {
      const result = recomputeIncrementalLayout(cache, nextTree, mutation);
      return {...result, recomputedNodeIds: [...result.recomputedNodeIds, "unrelated-group-0"]};
    };
    expect(runScalingContract(leaky, [8, 64], ["local-style"]).violations).toEqual([
      "local-style at 33 nodes: recomputed nodes outside the affected region: unrelated-group-0",
      "local-style at 201 nodes: recomputed nodes outside the affected region: unrelated-group-0",
    ]);
  });

  test("topology transitions must rebuild the graph exactly once each", () => {
    const stale: IncrementalLayoutExecutor = (cache, nextTree, mutation) => {
      const result = recomputeIncrementalLayout(cache, nextTree, mutation);
      return {...result, work: {...result.work, graphRebuilds: 0}};
    };
    expect(runScalingContract(stale, [8], ["dependency-topology"]).violations).toEqual([
      "dependency-topology at 33 nodes: 0 graph rebuilds for 2 topology transitions",
    ]);
  });

  test("identical mutations still reject unknown or incompatible targets", () => {
    const tree = buildScalingTree(8);
    const cache = createIncrementalLayoutCache(tree);
    expect(() => recomputeIncrementalLayout(cache, tree, {kind: "style", nodeId: "missing", field: "height"}))
      .toThrow("missing");
    expect(() => recomputeIncrementalLayout(cache, tree, {kind: "style", nodeId: "affected-leaf-1", field: "flexContainer.gap"}))
      .toThrow("requires a flex container");
  });

  test("a single population cannot prove independence", () => {
    expect(runScalingContract(recomputeIncrementalLayout, [64], ["local-style"]).violations).toEqual([
      "local-style: needs at least two unrelated populations to show independence",
    ]);
  });
});
