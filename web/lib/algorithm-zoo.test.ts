import {describe, expect, test} from "bun:test";
import {
  algorithmDefinitions,
  getAlgorithmDefinition,
  runAlgorithm,
  validateAlgorithmExecution,
} from "./algorithm-zoo";

describe("algorithm zoo contract", () => {
  test("registers stable unique algorithms behind one typed input/output contract", () => {
    expect(algorithmDefinitions.map((definition) => [definition.id, definition.inputKind])).toEqual([
      ["block-flow", "layout-tree"],
      ["flex-row", "layout-tree"],
      ["grid-row", "layout-tree"],
    ]);
    expect(new Set(algorithmDefinitions.map((definition) => definition.id)).size).toBe(algorithmDefinitions.length);
  });

  test("runs every registered algorithm into valid geometry, trace, and work evidence", () => {
    for (const definition of algorithmDefinitions) {
      const execution = runAlgorithm(definition.id);
      expect(execution.algorithmId).toBe(definition.id);
      expect(execution.input.kind).toBe("layout-tree");
      expect(execution.geometry.length).toBeGreaterThan(0);
      expect(execution.work.length).toBeGreaterThan(0);
      expect(validateAlgorithmExecution(execution)).toEqual([]);
    }
  });

  test("preserves algorithm-specific intermediate evidence behind the common trace surface", () => {
    expect(runAlgorithm("block-flow").trace[0]?.summary).toContain("resolves to 20px");
    expect(runAlgorithm("flex-row").trace.map((step) => step.summary).join(" ")).toContain("freeze B");
    expect(runAlgorithm("grid-row").trace.map((step) => step.summary).join(" ")).toContain("frozen at minimum");
  });

  test("keeps the common geometry output deterministic for existing engine fixtures", () => {
    expect(runAlgorithm("block-flow").geometry.find((box) => box.id === "content")).toMatchObject({
      x: 0,
      y: 76,
      width: 360,
      height: 132,
    });
    expect(runAlgorithm("flex-row").geometry.find((box) => box.id === "item-b")).toMatchObject({
      x: 160,
      width: 184,
      height: 104,
    });
    expect(runAlgorithm("grid-row").geometry.find((box) => box.id === "item-c")?.x).toBeCloseTo(325.33333333333337, 8);
  });

  test("rejects unknown registry ids at the lookup boundary", () => {
    expect(() => getAlgorithmDefinition("missing" as never)).toThrow("unknown layout algorithm: missing");
  });
});
