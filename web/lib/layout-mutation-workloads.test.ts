import {describe, expect, test} from "bun:test";
import {
  getMutationWorkloadDefinition,
  mutationWorkloadDefinitions,
  runMutationWorkload,
} from "./layout-mutation-workloads";

describe("H8 mutation workloads", () => {
  test("covers resize, content, insertion, reordering, and removal in one deterministic structural trace", () => {
    const result = runMutationWorkload("block-structure");

    expect(result.steps.map((step) => step.category)).toEqual([
      "resize",
      "content",
      "insert",
      "reorder",
      "remove",
    ]);
    expect(result.steps.map((step) => step.mode)).toEqual([
      "incremental",
      "incremental",
      "graph-rebuild",
      "graph-rebuild",
      "graph-rebuild",
    ]);
    expect(result.totalGraphRebuilds).toBe(3);
    expect(result.steps.every((step) => step.geometryMatchesClean)).toBe(true);
    expect(result.finalGeometry.map((box) => box.id)).toEqual([
      "block-root",
      "header",
      "content",
      "footer",
    ]);
    expect(result.finalGeometry.find((box) => box.id === "block-root")?.width).toBe(480);
    expect(result.finalGeometry.find((box) => box.id === "content")?.height).toBe(168);
  });

  test("shows Flex solver iterations are reused for a cross-size-only content change", () => {
    const result = runMutationWorkload("flex-solver");
    const [resize, content] = result.steps;

    expect(resize?.category).toBe("resize");
    expect(resize?.algorithmIterations).toBeGreaterThan(0);
    expect(resize?.algorithmIterations).toBe(resize?.cleanAlgorithmIterations);
    expect(content?.category).toBe("content");
    expect(content?.algorithmIterations).toBe(0);
    expect(content?.cleanAlgorithmIterations).toBeGreaterThan(0);
    expect(content?.geometryMatchesClean).toBe(true);
  });

  test("moves a Grid item from cached tracks without another track-resolution pass", () => {
    const result = runMutationWorkload("grid-solver");
    const [resize, placement] = result.steps;

    expect(resize?.algorithmIterations).toBe(1);
    expect(resize?.cleanAlgorithmIterations).toBe(1);
    expect(placement?.category).toBe("placement");
    expect(placement?.algorithmIterations).toBe(0);
    expect(placement?.cleanAlgorithmIterations).toBe(1);
    expect(placement?.geometryMatchesClean).toBe(true);
  });

  test("reports deterministic visited-node and solver-work evidence with no timing field", () => {
    for (const definition of mutationWorkloadDefinitions) {
      const first = runMutationWorkload(definition.id);
      const second = runMutationWorkload(definition.id);

      expect(second).toEqual(first);
      expect(first.steps.every((step) => Number.isInteger(step.visitedNodes) && step.visitedNodes >= 0)).toBe(true);
      expect(first.steps.every((step) => Number.isInteger(step.algorithmIterations) && step.algorithmIterations >= 0)).toBe(true);
      expect(first.steps.every((step) => Number.isInteger(step.boundaryNodeVisits) && step.boundaryNodeVisits >= 0)).toBe(true);
      expect(first.steps.every((step) => Number.isInteger(step.provenanceComparisons) && step.provenanceComparisons >= 0)).toBe(true);
      expect(first.steps.every((step) => step.invalidationPhaseVisits === step.dirtyPhaseCount)).toBe(true);
      expect(first.steps.every((step) => Number.isInteger(step.invalidationEdgeTraversals) && step.invalidationEdgeTraversals >= 0)).toBe(true);
      expect(first.totalBoundaryNodeVisits).toBe(first.steps.reduce((sum, step) => sum + step.boundaryNodeVisits, 0));
      expect(first.totalProvenanceComparisons).toBe(first.steps.reduce((sum, step) => sum + step.provenanceComparisons, 0));
      expect(first.totalInvalidationPhaseVisits).toBe(first.steps.reduce((sum, step) => sum + step.invalidationPhaseVisits, 0));
      expect(first.totalInvalidationEdgeTraversals).toBe(first.steps.reduce((sum, step) => sum + step.invalidationEdgeTraversals, 0));
      expect(first.totalVisitedNodes).toBe(first.steps.reduce((sum, step) => sum + step.visitedNodes, 0));
      expect(first.totalAlgorithmIterations).toBe(first.steps.reduce((sum, step) => sum + step.algorithmIterations, 0));
      expect(JSON.stringify(first)).not.toContain("duration");
      expect(JSON.stringify(first)).not.toContain("elapsed");
    }
  });

  test("rejects unknown workload ids", () => {
    expect(() => getMutationWorkloadDefinition("missing" as never))
      .toThrow("unknown layout mutation workload: missing");
  });
});
