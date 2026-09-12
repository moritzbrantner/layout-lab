import {describe, expect, test} from "bun:test";
import {
  compareLayoutGeometry,
  compareLayoutGeometryWithPolicy,
  DEFAULT_GEOMETRY_POLICY,
} from "./browser-layout-adapter";
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

  test("uses a versioned per-field policy with fixed normalization precision", () => {
    const result = compareLayoutGeometryWithPolicy(engineBoxes, [
      {id: "root", x: 0, y: 0, width: 300.50004, height: 100},
      {id: "a", x: 0.50004, y: 0, width: 120, height: 80.50006},
    ], DEFAULT_GEOMETRY_POLICY);

    expect(DEFAULT_GEOMETRY_POLICY).toEqual({
      version: "layout-geometry-v1",
      tolerance: {x: 0.5, y: 0.5, width: 0.5, height: 0.5},
      roundingDecimals: 4,
    });
    expect(result.find((comparison) => comparison.id === "root")?.fields.find((field) => field.field === "width"))
      .toMatchObject({engine: 300, browser: 300.5, delta: 0.5, matches: true});
    expect(result.find((comparison) => comparison.id === "a")?.fields.find((field) => field.field === "height"))
      .toMatchObject({browser: 80.5001, delta: 0.5001, matches: false});
  });

  test("rejects invalid tolerance values and malformed policy values", () => {
    expect(() => compareLayoutGeometry(engineBoxes, [], -1)).toThrow("geometry tolerance must be finite and non-negative");
    expect(() => compareLayoutGeometryWithPolicy(engineBoxes, [], {
      version: "bad",
      tolerance: {x: -1, y: 0, width: 0, height: 0},
      roundingDecimals: 4,
    })).toThrow("x geometry tolerance must be finite and non-negative");
    expect(() => compareLayoutGeometryWithPolicy(engineBoxes, [], {
      version: "bad",
      tolerance: {x: 0, y: 0, width: 0, height: 0},
      roundingDecimals: 13,
    })).toThrow("geometry roundingDecimals must be an integer between 0 and 12");
  });
});
