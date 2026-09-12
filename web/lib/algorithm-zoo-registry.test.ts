import {describe, expect, test} from "bun:test";
import {
  algorithmRegistryDefinitions,
  getAlgorithmRegistryDefinition,
  runRegistryAlgorithm,
  validateRegistryExecution,
} from "./algorithm-zoo-registry";

describe("combined algorithm zoo registry", () => {
  test("keeps every registered family behind one outward execution contract", () => {
    expect(algorithmRegistryDefinitions.map((definition) => [definition.id, definition.inputKind]).slice(-2)).toEqual([
      ["dag-sugiyama", "dag"],
      ["graph-force", "graph"],
    ]);
    expect(new Set(algorithmRegistryDefinitions.map((definition) => definition.id)).size)
      .toBe(algorithmRegistryDefinitions.length);

    for (const definition of algorithmRegistryDefinitions) {
      expect(validateRegistryExecution(runRegistryAlgorithm(definition.id))).toEqual([]);
    }
  });

  test("adapts the existing zoo definitions without changing their outputs", () => {
    expect(runRegistryAlgorithm("packing-first-fit").geometry.find((box) => box.id === "packing-root")?.height).toBe(270);
    expect(runRegistryAlgorithm("tree-tidy").geometry.find((box) => box.id === "root")).toMatchObject({
      x: 126,
      y: 0,
      width: 48,
      height: 32,
    });
  });

  test("exposes the full Sugiyama phase pipeline in trace and work evidence", () => {
    const execution = runRegistryAlgorithm("dag-sugiyama");

    expect(execution.input.kind).toBe("dag");
    expect(execution.trace[0]).toMatchObject({id: "ranking", label: "1. Ranking"});
    expect(execution.trace[1]?.summary).toContain("2 dummy vertices");
    expect(execution.trace.some((step) => step.summary.includes("7 → 0 crossings"))).toBe(true);
    expect(execution.trace.at(-1)).toMatchObject({id: "coordinates", label: "4. Coordinate assignment"});
    expect(execution.work.find((counter) => counter.key === "initial-crossings")?.value).toBe(7);
    expect(execution.work.find((counter) => counter.key === "final-crossings")?.value).toBe(0);
    expect(execution.work.find((counter) => counter.key === "dummies")?.value).toBe(2);
  });

  test("keeps dummy geometry explicit so long-edge normalization is inspectable", () => {
    const execution = runRegistryAlgorithm("dag-sugiyama");
    expect(execution.geometry.find((box) => box.id === "__dummy:a-i:1")).toEqual({
      id: "__dummy:a-i:1",
      x: 95,
      y: 95,
      width: 10,
      height: 10,
    });
    expect(execution.diagnostics.join(" ")).toContain("acyclic");
  });

  test("exposes replayable force convergence evidence through the common trace", () => {
    const execution = runRegistryAlgorithm("graph-force");

    expect(execution.input.kind).toBe("graph");
    expect(execution.trace.map((step) => step.label)).toEqual([
      "iteration 1",
      "iteration 20",
      "iteration 40",
      "iteration 60",
      "iteration 80",
      "iteration 100",
      "iteration 120",
      "iteration 140",
      "iteration 160",
    ]);
    expect(execution.trace.at(-1)?.summary).toContain("temperature 0");
    expect(execution.work.find((counter) => counter.key === "iterations")?.value).toBe(160);
    expect(execution.work.find((counter) => counter.key === "repulsions")?.value).toBe(4480);
    expect(execution.work.find((counter) => counter.key === "attractions")?.value).toBe(1760);
    expect(execution.diagnostics).toContain("seed: 20260912");
  });

  test("replays the same force-directed registry execution", () => {
    const first = runRegistryAlgorithm("graph-force");
    const second = runRegistryAlgorithm("graph-force");
    expect(second.geometry).toEqual(first.geometry);
    expect(second.trace).toEqual(first.trace);
  });

  test("rejects unknown combined-registry ids", () => {
    expect(() => getAlgorithmRegistryDefinition("missing" as never)).toThrow("unknown layout algorithm: missing");
  });
});
