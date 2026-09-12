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
      ["constraint-cassowary", "constraint-system"],
      ["line-greedy", "line-break"],
      ["line-knuth-plass", "line-break"],
      ["packing-shortest-column", "packing"],
      ["packing-first-fit", "packing"],
    ]);
    expect(new Set(algorithmDefinitions.map((definition) => definition.id)).size).toBe(algorithmDefinitions.length);
  });

  test("runs every registered algorithm into valid geometry, trace, and work evidence", () => {
    for (const definition of algorithmDefinitions) {
      const execution = runAlgorithm(definition.id);
      expect(execution.algorithmId).toBe(definition.id);
      expect(execution.geometry.length).toBeGreaterThan(0);
      expect(execution.work.length).toBeGreaterThan(0);
      expect(validateAlgorithmExecution(execution)).toEqual([]);
    }
  });

  test("preserves algorithm-specific intermediate evidence behind the common trace surface", () => {
    expect(runAlgorithm("block-flow").trace[0]?.summary).toContain("resolves to 20px");
    expect(runAlgorithm("flex-row").trace.map((step) => step.summary).join(" ")).toContain("freeze B");
    expect(runAlgorithm("grid-row").trace.map((step) => step.summary).join(" ")).toContain("frozen at minimum");
    expect(runAlgorithm("constraint-cassowary").trace.map((step) => step.label).join(" ")).toContain("remove temporary A width cap");
    expect(runAlgorithm("line-greedy").trace[0]?.label).toContain("layout engines");
    expect(runAlgorithm("line-knuth-plass").trace[0]?.summary).toContain("ratio -0.625");
    expect(runAlgorithm("packing-first-fit").trace.at(-1)?.summary).toContain("column 2");
  });

  test("keeps the common geometry output deterministic across algorithm families", () => {
    expect(runAlgorithm("block-flow").geometry.find((box) => box.id === "content")).toMatchObject({x: 0, y: 76, width: 360, height: 132});
    expect(runAlgorithm("flex-row").geometry.find((box) => box.id === "item-b")).toMatchObject({x: 160, width: 184, height: 104});
    expect(runAlgorithm("grid-row").geometry.find((box) => box.id === "item-c")?.x).toBeCloseTo(325.33333333333337, 8);
    expect(runAlgorithm("constraint-cassowary").geometry.find((box) => box.id === "panel-a")).toMatchObject({x: 0, width: 249.6, height: 140});
    expect(runAlgorithm("line-knuth-plass").geometry.find((box) => box.id === "balance")).toMatchObject({x: 190, y: 0, width: 70});
    expect(runAlgorithm("packing-first-fit").geometry.find((box) => box.id === "filler")).toMatchObject({x: 110, y: 70, width: 100, height: 100});
  });

  test("exposes the greedy versus global line-break difference on one shared fixture", () => {
    const greedy = runAlgorithm("line-greedy");
    const optimized = runAlgorithm("line-knuth-plass");

    expect(greedy.input).toEqual(optimized.input);
    expect(greedy.geometry.find((box) => box.id === "paragraph")?.height).toBe(96);
    expect(optimized.geometry.find((box) => box.id === "paragraph")?.height).toBe(64);
    expect(optimized.work.find((counter) => counter.key === "states")?.value).toBeGreaterThan(1);
  });

  test("exposes the skyline versus first-fit packing difference on one shared fixture", () => {
    const skyline = runAlgorithm("packing-shortest-column");
    const firstFit = runAlgorithm("packing-first-fit");

    expect(skyline.input).toEqual(firstFit.input);
    expect(skyline.geometry.find((box) => box.id === "packing-root")?.height).toBe(330);
    expect(firstFit.geometry.find((box) => box.id === "packing-root")?.height).toBe(270);
    expect(skyline.diagnostics).toContain("packed height: 330px");
    expect(firstFit.diagnostics).toContain("packed height: 270px");
  });

  test("surfaces algorithm-specific diagnostics", () => {
    const constraint = runAlgorithm("constraint-cassowary");
    expect(constraint.diagnostics).toContain("medium B width preference: 62.4px residual");
    expect(constraint.work.find((counter) => counter.key === "pivots")?.value).toBeGreaterThan(0);

    const lineBreak = runAlgorithm("line-knuth-plass");
    expect(lineBreak.diagnostics.join(" ")).toContain("glyph shaping and hyphenation remain outside this model");
  });

  test("rejects unknown registry ids at the lookup boundary", () => {
    expect(() => getAlgorithmDefinition("missing" as never)).toThrow("unknown layout algorithm: missing");
  });
});
