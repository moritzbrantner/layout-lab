import {describe, expect, test} from "bun:test";
import {
  collectAnimatedStyleProperties,
  includesPaintContainment,
  STANDARD_COMPOSITOR_LAYER_EVIDENCE,
} from "./compositing-observations";

describe("compositing observation helpers", () => {
  test("extracts animated style properties without keyframe metadata", () => {
    expect(collectAnimatedStyleProperties([
      {offset: 0, computedOffset: 0, easing: "linear", transform: "translateX(0px)", opacity: "1"},
      {offset: 1, computedOffset: 1, easing: "linear", transform: "translateX(20px)", opacity: "0.5"},
    ])).toEqual(["opacity", "transform"]);
  });

  test("recognizes paint containment shorthands", () => {
    expect(includesPaintContainment("paint")).toBe(true);
    expect(includesPaintContainment("layout paint")).toBe(true);
    expect(includesPaintContainment("content")).toBe(true);
    expect(includesPaintContainment("strict")).toBe(true);
    expect(includesPaintContainment("layout style")).toBe(false);
    expect(includesPaintContainment("none")).toBe(false);
  });

  test("never claims compositor layer visibility from standard APIs", () => {
    expect(STANDARD_COMPOSITOR_LAYER_EVIDENCE).toBe("not exposed by standard web APIs");
  });
});
