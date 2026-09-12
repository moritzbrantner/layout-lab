import {describe, expect, test} from "bun:test";
import {
  buildFlexAlgorithmPipeline,
  buildGridAlgorithmPipeline,
  validateAlgorithmPipeline,
} from "./algorithm-pipeline";

describe("algorithm pipeline", () => {
  test("exposes the flex freeze loop as a deterministic feedback dependency", () => {
    const pipeline = buildFlexAlgorithmPipeline();

    expect(validateAlgorithmPipeline(pipeline)).toEqual([]);
    expect(pipeline.scenario).toBe("flex");
    expect(pipeline.edges).toContainEqual({
      from: "freeze-loop",
      to: "weighted-distribution",
      kind: "feedback",
      label: "recompute remaining free space after freezing",
    });
    expect(pipeline.finalGeometry).toHaveLength(3);
  });

  test("exposes grid contribution growth before flexible-track resolution", () => {
    const pipeline = buildGridAlgorithmPipeline();

    expect(validateAlgorithmPipeline(pipeline)).toEqual([]);
    expect(pipeline.scenario).toBe("grid");
    expect(pipeline.nodes.find((node) => node.id === "base-growth")?.detail).toContain("span A+B");
    expect(pipeline.edges).toContainEqual({
      from: "span-contributions",
      to: "base-growth",
      kind: "dependency",
      label: "minimum contributions",
    });
    expect(pipeline.finalGeometry).toHaveLength(3);
  });

  test("keeps node ids and edge endpoints internally consistent", () => {
    const pipeline = buildFlexAlgorithmPipeline({innerSize: 460, gapSize: 12});
    const ids = new Set(pipeline.nodes.map((node) => node.id));

    expect(new Set(ids).size).toBe(pipeline.nodes.length);
    expect(pipeline.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true);
  });
});
