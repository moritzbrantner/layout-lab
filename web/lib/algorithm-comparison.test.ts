import {describe, expect, test} from "bun:test";
import {
  algorithmComparisonDefinitions,
  algorithmComparisonTitles,
  getAlgorithmComparisonDefinition,
  runAlgorithmComparison,
} from "./algorithm-comparison";

describe("same-fixture algorithm comparisons", () => {
  test("registers the two algorithm pairs that currently share exact fixtures", () => {
    expect(algorithmComparisonDefinitions.map((definition) => [definition.id, definition.algorithmIds])).toEqual([
      ["line-breaking", ["line-greedy", "line-knuth-plass"]],
      ["packing", ["packing-shortest-column", "packing-first-fit"]],
    ]);
  });

  test("compares line breakers only after proving their input fixtures are identical", () => {
    const comparison = runAlgorithmComparison("line-breaking");

    expect(comparison.exactInputMatch).toBe(true);
    expect(comparison.fixtureId).toBe("premeasured-paragraph");
    expect(comparison.inputKind).toBe("line-break");
    expect(comparison.primaryValues).toEqual([96, 64]);
    expect(algorithmComparisonTitles("line-breaking")).toEqual([
      "Greedy line breaking",
      "Knuth–Plass line breaking",
    ]);
    expect(comparison.geometryRows.find((row) => row.id === "paragraph")?.values).toEqual([
      {x: 0, y: 0, width: 260, height: 96},
      {x: 0, y: 0, width: 260, height: 64},
    ]);
  });

  test("compares packing algorithms over the exact same skyline-hole fixture", () => {
    const comparison = runAlgorithmComparison("packing");

    expect(comparison.exactInputMatch).toBe(true);
    expect(comparison.fixtureId).toBe("skyline-hole");
    expect(comparison.inputKind).toBe("packing");
    expect(comparison.primaryValues).toEqual([330, 270]);
    expect(comparison.geometryRows.find((row) => row.id === "filler")?.values).toEqual([
      {x: 220, y: 230, width: 100, height: 100},
      {x: 110, y: 70, width: 100, height: 100},
    ]);
  });

  test("rejects unknown comparison ids", () => {
    expect(() => getAlgorithmComparisonDefinition("missing" as never)).toThrow("unknown algorithm comparison: missing");
  });
});
