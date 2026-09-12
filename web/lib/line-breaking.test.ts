import {describe, expect, test} from "bun:test";
import {breakLinesGreedy, breakLinesKnuthPlass, buildLineBreakingFixture} from "./line-breaking";

describe("line breaking algorithms", () => {
  test("greedy commits to the widest natural-width prefix on each line", () => {
    const result = breakLinesGreedy(buildLineBreakingFixture());

    expect(result.lines.map((line) => line.wordIds)).toEqual([
      ["layout", "engines"],
      ["balance", "global"],
      ["spacing", "choices"],
    ]);
    expect(result.lines.map((line) => line.naturalWidth)).toEqual([190, 180, 160]);
    expect(result.geometry.find((box) => box.id === "paragraph")?.height).toBe(96);
    expect(result.candidateEvaluations).toBe(5);
  });

  test("Knuth-Plass-style optimization chooses the globally feasible two-line break sequence", () => {
    const result = breakLinesKnuthPlass(buildLineBreakingFixture());

    expect(result.lines.map((line) => line.wordIds)).toEqual([
      ["layout", "engines", "balance"],
      ["global", "spacing", "choices"],
    ]);
    expect(result.lines.map((line) => line.naturalWidth)).toEqual([270, 270]);
    expect(result.lines.map((line) => line.adjustedSpaceWidth)).toEqual([5, 5]);
    expect(result.lines.map((line) => line.adjustmentRatio)).toEqual([-0.625, -0.625]);
    expect(result.geometry.find((box) => box.id === "balance")).toMatchObject({x: 190, y: 0, width: 70});
    expect(result.geometry.find((box) => box.id === "global")).toMatchObject({x: 0, y: 32, width: 100});
    expect(result.geometry.find((box) => box.id === "paragraph")?.height).toBe(64);
    expect(result.totalDemerits).toBeGreaterThan(0);
    expect(result.dynamicStates).toBeGreaterThan(1);
  });

  test("keeps glyph measurement and discretionary breaking outside the bounded model", () => {
    const fixture = buildLineBreakingFixture();
    expect(() => breakLinesKnuthPlass({...fixture, words: [{id: "oversized", width: 300}]}))
      .toThrow("word box exceeds line width without a discretionary break");
    expect(() => breakLinesGreedy({...fixture, words: [{id: "x", width: 40}, {id: "x", width: 40}]}))
      .toThrow("word ids must be unique");
  });

  test("fails closed when glue cannot realize any non-final optimized line", () => {
    const fixture = buildLineBreakingFixture();
    expect(() => breakLinesKnuthPlass({...fixture, spaceStretch: 0, spaceShrink: 0}))
      .toThrow("no feasible Knuth-Plass line-break sequence");
  });
});
