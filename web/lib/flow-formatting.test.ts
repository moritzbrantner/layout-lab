import {describe, expect, test} from "bun:test";
import {resolveAdjacentPositiveMargins} from "./flow-formatting";

describe("resolveAdjacentPositiveMargins", () => {
  test("collapses adjacent positive block margins to the larger margin", () => {
    expect(resolveAdjacentPositiveMargins({mode: "collapse", before: 36, after: 20})).toEqual({
      mode: "collapse",
      before: 36,
      after: 20,
      gap: 36,
      rule: "max",
    });
  });

  test("keeps margins separate when the children are flex items", () => {
    expect(resolveAdjacentPositiveMargins({mode: "separate", before: 36, after: 20}).gap).toBe(56);
  });

  test("normalizes unsupported negative and non-finite inputs out of the scoped model", () => {
    expect(resolveAdjacentPositiveMargins({mode: "collapse", before: -10, after: Number.NaN}).gap).toBe(0);
  });
});
