import {describe, expect, test} from "bun:test";
import {compareLayoutGeometry} from "./browser-layout-adapter";
import type {LayoutBox} from "./layout-engine";

const engineBoxes: readonly LayoutBox[] = [
  {id: "root", label: "Root", rect: {x: 0, y: 0, width: 300, height: 100}, children: []},
  {id: "a", label: "A", rect: {x: 0, y: 0, width: 120, height: 80}, children: []},
];

describe("browser layout adapter", () => {
  test("accepts browser geometry within the explicit tolerance", () => {
    const result = compareLayoutGeometry(engineBoxes, [
      {id: "root", x: 0, y: 0, width: 300.2, height: 100},
      {id: "a", x: 0.1, y: 0, width: 119.7, height: 80.3},
    ], 0.5);

    expect(result.every((comparison) => comparison.matches)).toBe(true);
    expect(result.find((comparison) => comparison.id === "a")?.maximumDelta).toBeCloseTo(0.3, 8);
  });

  test("reports field-level drift outside tolerance", () => {
    const result = compareLayoutGeometry(engineBoxes, [
      {id: "root", x: 0, y: 0, width: 300, height: 100},
      {id: "a", x: 2, y: 0, width: 120, height: 80},
    ], 0.5);
    const item = result.find((comparison) => comparison.id === "a")!;

    expect(item.matches).toBe(false);
    expect(item.fields.find((field) => field.field === "x")).toEqual({
      field: "x",
      engine: 0,
      browser: 2,
      delta: 2,
      matches: false,
    });
  });

  test("fails a comparison when either side is missing", () => {
    const result = compareLayoutGeometry(engineBoxes, [
      {id: "root", x: 0, y: 0, width: 300, height: 100},
      {id: "browser-only", x: 0, y: 0, width: 10, height: 10},
    ]);

    expect(result.find((comparison) => comparison.id === "a")?.matches).toBe(false);
    expect(result.find((comparison) => comparison.id === "browser-only")?.matches).toBe(false);
  });

  test("rejects invalid tolerance values", () => {
    expect(() => compareLayoutGeometry(engineBoxes, [], -1)).toThrow("geometry tolerance must be finite and non-negative");
  });
});
