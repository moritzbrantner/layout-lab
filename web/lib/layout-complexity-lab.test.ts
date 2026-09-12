import {describe, expect, test} from "bun:test";
import {COMPLEXITY_LAB_VERSION, runLayoutComplexityLab} from "./layout-complexity-lab";

function counterValue(
  sample: ReturnType<typeof runLayoutComplexityLab>["samples"][number],
  key: string,
) {
  const counter = sample.counters.find((candidate) => candidate.key === key);
  if (!counter) throw new Error(`${sample.id}: missing counter ${key}`);
  return counter.value;
}

describe("layout complexity laboratory", () => {
  test("replays identical raw samples without clocks or browser evidence", () => {
    const first = runLayoutComplexityLab();
    const second = runLayoutComplexityLab();

    expect(first).toEqual(second);
    expect(first.version).toBe(COMPLEXITY_LAB_VERSION);
    expect(first.methodology.join(" ")).toContain("no DOM measurement");
    expect(first.methodology.join(" ")).toContain("no DOM measurement, rendering, timers, or wall-clock claims");
  });

  test("scales Flex work by items and exposes passes, freezes, and item evaluations", () => {
    const flex = runLayoutComplexityLab().samples.filter((sample) => sample.suite === "flex");

    expect(flex.map((sample) => sample.dimensions[0]?.value)).toEqual([4, 8, 16, 32, 64]);
    for (const sample of flex) {
      expect(counterValue(sample, "passes")).toBeGreaterThanOrEqual(1);
      expect(counterValue(sample, "evaluations")).toBeGreaterThanOrEqual(sample.dimensions[0]!.value);
      expect(counterValue(sample, "freezes")).toBeGreaterThanOrEqual(1);
    }
  });

  test("scales Grid tracks and spans with explicit contribution and flexible-track work", () => {
    const grid = runLayoutComplexityLab().samples.filter((sample) => sample.suite === "grid");

    expect(grid.map((sample) => sample.dimensions.find((dimension) => dimension.key === "tracks")?.value))
      .toEqual([4, 8, 16, 32, 64]);
    expect(grid.map((sample) => sample.dimensions.find((dimension) => dimension.key === "spans")?.value))
      .toEqual([1, 2, 4, 8, 16]);
    for (const sample of grid) {
      expect(counterValue(sample, "contribution-steps")).toBe(sample.dimensions.find((dimension) => dimension.key === "spans")!.value);
      expect(counterValue(sample, "span-visits")).toBeGreaterThanOrEqual(counterValue(sample, "contribution-steps") * 2);
      expect(counterValue(sample, "passes")).toBeGreaterThanOrEqual(1);
      expect(counterValue(sample, "evaluations")).toBeGreaterThanOrEqual(sample.dimensions.find((dimension) => dimension.key === "tracks")!.value);
    }
  });

  test("scales Cassowary constraints and records real tableau work", () => {
    const constraints = runLayoutComplexityLab().samples.filter((sample) => sample.suite === "constraints");

    expect(constraints.map((sample) => sample.dimensions.find((dimension) => dimension.key === "variables")?.value))
      .toEqual([4, 8, 16, 32]);
    for (const sample of constraints) {
      const variables = sample.dimensions.find((dimension) => dimension.key === "variables")!.value;
      expect(sample.dimensions.find((dimension) => dimension.key === "constraints")?.value).toBe(variables * 2);
      expect(counterValue(sample, "operations")).toBe(variables * 2);
      expect(counterValue(sample, "rows")).toBeGreaterThan(0);
      expect(counterValue(sample, "pivots")).toBeGreaterThanOrEqual(0);
    }
  });

  test("compares incremental and clean layout over identical mutation traces", () => {
    const incremental = runLayoutComplexityLab().samples.filter((sample) => sample.suite === "incremental");

    expect(incremental.map((sample) => sample.dimensions.find((dimension) => dimension.key === "mutations")?.value))
      .toEqual([1, 4, 8]);
    for (const sample of incremental) {
      expect(counterValue(sample, "incremental-visits")).toBeLessThan(counterValue(sample, "full-visits"));
      expect(counterValue(sample, "reused")).toBeGreaterThan(0);
      expect(counterValue(sample, "recomputed")).toBeGreaterThan(0);
    }
  });

  test("pins one-freeze-per-pass pathological fixtures", () => {
    const pathologies = runLayoutComplexityLab().pathologies;
    const flex = pathologies.find((pathology) => pathology.id === "flex-freeze-ladder")!;
    const grid = pathologies.find((pathology) => pathology.id === "grid-freeze-ladder")!;

    for (const pathology of [flex, grid]) {
      expect(pathology.scale).toBe(8);
      expect(pathology.passes).toBe(8);
      expect(pathology.freezeSequence).toHaveLength(8);
      expect(pathology.freezeSequence.slice(0, 7).every((frozen) => frozen.length === 1)).toBe(true);
      expect(pathology.freezeSequence.at(-1)).toEqual([]);
      expect(pathology.evaluations).toBe(36);
    }
  });
});
