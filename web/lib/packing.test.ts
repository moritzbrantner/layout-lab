import {describe, expect, test} from "bun:test";
import {buildPackingFixture, packFirstFit, packShortestColumn} from "./packing";

describe("packing algorithms", () => {
  test("shortest-column placement follows the skyline and misses the middle-column hole", () => {
    const result = packShortestColumn(buildPackingFixture());

    expect(result.placements.map((placement) => [placement.id, placement.columnStart, placement.y])).toEqual([
      ["tall-left", 0, 0],
      ["short-middle", 1, 0],
      ["tall-right", 2, 0],
      ["bridge", 0, 210],
      ["filler", 2, 230],
    ]);
    expect(result.containerHeight).toBe(330);
    expect(result.geometry.find((box) => box.id === "bridge")).toMatchObject({x: 0, y: 210, width: 210, height: 60});
  });

  test("deterministic first-fit scans top-left candidate positions and fills the skyline hole", () => {
    const result = packFirstFit(buildPackingFixture());

    expect(result.placements.map((placement) => [placement.id, placement.columnStart, placement.y])).toEqual([
      ["tall-left", 0, 0],
      ["short-middle", 1, 0],
      ["tall-right", 2, 0],
      ["bridge", 0, 210],
      ["filler", 1, 70],
    ]);
    expect(result.containerHeight).toBe(270);
    expect(result.geometry.find((box) => box.id === "filler")).toMatchObject({x: 110, y: 70, width: 100, height: 100});
    expect(result.candidateEvaluations).toBeGreaterThan(5);
  });

  test("shows a lower packed height for first-fit on the shared fixture", () => {
    const input = buildPackingFixture();
    expect(packFirstFit(input).containerHeight).toBeLessThan(packShortestColumn(input).containerHeight);
  });

  test("validates spans, ids, and usable column width", () => {
    const input = buildPackingFixture();
    expect(() => packShortestColumn({...input, columns: 0})).toThrow("positive integer");
    expect(() => packFirstFit({...input, items: [{id: "wide", columnSpan: 4, height: 20}]})).toThrow("columnSpan");
    expect(() => packFirstFit({...input, items: [{id: "x", columnSpan: 1, height: 20}, {id: "x", columnSpan: 1, height: 30}]})).toThrow("duplicate packing item id");
  });
});
